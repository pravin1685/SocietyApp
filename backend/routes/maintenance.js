const express = require('express');
const { db } = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/rates', (req, res) => {
  const rates = db.prepare('SELECT * FROM maintenance_rates ORDER BY year').all();
  res.json(rates);
});

router.put('/rates/:year', adminOnly, (req, res) => {
  const { without_noc, with_noc, empty_flat } = req.body;
  db.prepare(`INSERT INTO maintenance_rates (year, without_noc, with_noc, empty_flat) VALUES (?,?,?,?)
    ON CONFLICT(year) DO UPDATE SET without_noc=excluded.without_noc, with_noc=excluded.with_noc, empty_flat=excluded.empty_flat`)
    .run(req.params.year, without_noc, with_noc, empty_flat ?? 0);
  res.json({ message: 'Rates updated' });
});

router.get('/', (req, res) => {
  const { year, flat_id } = req.query;

  let flatFilter = '';
  const params = [];

  if (req.user.role !== 'admin') {
    flatFilter = 'AND mp.flat_id = ?';
    params.push(req.user.flat_id);
  } else if (flat_id) {
    flatFilter = 'AND mp.flat_id = ?';
    params.push(flat_id);
  }

  if (year) params.push(year);

  const rows = db.prepare(`
    SELECT mp.*, f.flat_no, f.owner_name, f.is_rented
    FROM maintenance_payments mp
    JOIN flats f ON f.id = mp.flat_id
    WHERE 1=1 ${flatFilter} ${year ? 'AND mp.year = ?' : ''}
    ORDER BY f.sl_no, mp.year, mp.month
  `).all(...params);

  res.json(rows);
});

router.get('/summary/:year', (req, res) => {
  const { year } = req.params;
  const isAdmin = req.user.role === 'admin';
  const flatFilter = isAdmin ? '' : 'AND f.id = ?';
  const params = isAdmin ? [year] : [year, req.user.flat_id];

  // Get the year's rates for monthly_rate calculation
  const rateRow = db.prepare('SELECT * FROM maintenance_rates WHERE year = ?').get(year)
    || { without_noc: 250, with_noc: 500, empty_flat: 0 };

  const rows = db.prepare(`
    SELECT
      f.id, f.flat_no, f.owner_name, f.is_rented, f.tenant_name, f.mobile,
      SUM(CASE WHEN mp.status='paid' THEN mp.amount ELSE 0 END) as total_paid,
      SUM(CASE WHEN mp.status='pending' THEN 1 ELSE 0 END) as pending_months,
      COUNT(mp.id) as total_months
    FROM flats f
    LEFT JOIN maintenance_payments mp ON mp.flat_id = f.id AND mp.year = ?
    WHERE 1=1 ${flatFilter}
    GROUP BY f.id
    ORDER BY f.sl_no
  `).all(...params);

  // Attach monthly_rate per flat based on type
  const result = rows.map(f => ({
    ...f,
    monthly_rate: f.is_rented === 1 ? rateRow.with_noc
                : f.is_rented === 2 ? rateRow.empty_flat
                : rateRow.without_noc,
  }));
  res.json(result);
});

router.post('/', adminOnly, (req, res) => {
  const { flat_id, year, month, amount, status, payment_date, payment_mode, month_occupancy } = req.body;
  db.prepare(`
    INSERT INTO maintenance_payments (flat_id, year, month, amount, status, payment_date, payment_mode, month_occupancy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(flat_id, year, month) DO UPDATE SET
      amount=excluded.amount, status=excluded.status,
      payment_date=excluded.payment_date, payment_mode=excluded.payment_mode,
      month_occupancy=excluded.month_occupancy
  `).run(flat_id, year, month, amount || 0, status || 'pending',
    payment_date || null, payment_mode || '',
    month_occupancy !== undefined ? month_occupancy : null);
  res.json({ message: 'Payment saved' });
});

router.put('/:id', adminOnly, (req, res) => {
  const { amount, status, payment_date, payment_mode } = req.body;
  db.prepare('UPDATE maintenance_payments SET amount=?, status=?, payment_date=?, payment_mode=? WHERE id=?')
    .run(amount, status, payment_date || null, payment_mode || '', req.params.id);
  res.json({ message: 'Payment updated' });
});

module.exports = router;
