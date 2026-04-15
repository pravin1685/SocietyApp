const express = require('express');
const { db } = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const { year, month, type } = req.query;
  const params = [];
  const conditions = [];

  if (year) { conditions.push('year = ?'); params.push(year); }
  if (month) { conditions.push('month = ?'); params.push(month); }
  if (type) { conditions.push('type = ?'); params.push(type); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const rows = db.prepare(`SELECT * FROM ledger_entries ${where} ORDER BY year, month, id`).all(...params);
  res.json(rows);
});

router.get('/monthly-summary/:year', (req, res) => {
  const rows = db.prepare(`
    SELECT month,
      SUM(CASE WHEN type='receipt' THEN amount ELSE 0 END) as total_receipts,
      SUM(CASE WHEN type='payment' THEN amount ELSE 0 END) as total_payments
    FROM ledger_entries WHERE year = ?
    GROUP BY month ORDER BY month
  `).all(req.params.year);

  // Calculate running (carry-forward) balance month by month
  let runningBalance = 0;
  const result = rows.map(row => {
    const opening_balance = runningBalance;
    const closing_balance = opening_balance + (row.total_receipts || 0) - (row.total_payments || 0);
    runningBalance = closing_balance;
    return { ...row, opening_balance, closing_balance };
  });
  res.json(result);
});

// Month-wise detail: receipts & payments per month with running balance
router.get('/monthly-detail/:year', (req, res) => {
  const year = req.params.year;
  const entries = db.prepare(
    `SELECT * FROM ledger_entries WHERE year = ? ORDER BY month, id`
  ).all(year);

  // Group by month
  const monthMap = {};
  entries.forEach(e => {
    if (!monthMap[e.month]) monthMap[e.month] = { receipts: [], payments: [] };
    if (e.type === 'receipt') monthMap[e.month].receipts.push(e);
    else monthMap[e.month].payments.push(e);
  });

  // Build result with running balance
  let runningBalance = 0;
  const result = Object.keys(monthMap).sort((a,b)=>+a-+b).map(m => {
    const r = monthMap[m];
    const total_receipts = r.receipts.reduce((s,e)=>s+e.amount,0);
    const total_payments = r.payments.reduce((s,e)=>s+e.amount,0);
    const opening_balance = runningBalance;
    const closing_balance = opening_balance + total_receipts - total_payments;
    runningBalance = closing_balance;
    return {
      month: +m,
      opening_balance,
      receipts: r.receipts,
      payments: r.payments,
      total_receipts,
      total_payments,
      closing_balance,
    };
  });
  res.json(result);
});

router.post('/', adminOnly, (req, res) => {
  const { year, month, entry_date, voucher_no, type, details, payment_mode, amount } = req.body;
  if (!type || !details || !amount) return res.status(400).json({ error: 'type, details and amount required' });
  const result = db.prepare(
    'INSERT INTO ledger_entries (year, month, entry_date, voucher_no, type, details, payment_mode, amount) VALUES (?,?,?,?,?,?,?,?)'
  ).run(year, month, entry_date || null, voucher_no || '', type, details, payment_mode || '', amount);
  res.json({ id: result.lastInsertRowid, message: 'Entry added' });
});

router.put('/:id', adminOnly, (req, res) => {
  const { entry_date, voucher_no, type, details, payment_mode, amount } = req.body;
  db.prepare('UPDATE ledger_entries SET entry_date=?, voucher_no=?, type=?, details=?, payment_mode=?, amount=? WHERE id=?')
    .run(entry_date || null, voucher_no || '', type, details, payment_mode || '', amount, req.params.id);
  res.json({ message: 'Entry updated' });
});

router.delete('/:id', adminOnly, (req, res) => {
  db.prepare('DELETE FROM ledger_entries WHERE id=?').run(req.params.id);
  res.json({ message: 'Entry deleted' });
});

module.exports = router;
