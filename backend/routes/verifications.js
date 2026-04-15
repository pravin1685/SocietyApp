const express = require('express');
const { db } = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── Resident: Submit UTR for verification ────────────────────────────────────
router.post('/', (req, res) => {
  const { flat_id, year, month, amount, utr_number, payment_mode, screenshot } = req.body;

  // Non-admin can only submit for their own flat
  const targetFlatId = req.user.role === 'admin' ? flat_id : req.user.flat_id;
  if (!targetFlatId) return res.status(400).json({ error: 'Flat not assigned' });
  if (!utr_number)   return res.status(400).json({ error: 'UTR number required' });

  // Check duplicate UTR
  const dup = db.prepare('SELECT id FROM payment_verifications WHERE utr_number = ?').get(utr_number);
  if (dup) return res.status(400).json({ error: 'हा UTR आधीच submit झाला आहे' });

  db.prepare(`
    INSERT INTO payment_verifications
      (flat_id, year, month, amount, utr_number, payment_mode, screenshot, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(targetFlatId, year, month, amount || 0, utr_number, payment_mode || 'UPI', screenshot || '');

  res.json({ message: 'Payment submitted for verification! ✅' });
});

// ── Resident: Get own pending verifications ──────────────────────────────────
router.get('/my', (req, res) => {
  const rows = db.prepare(`
    SELECT pv.*, f.flat_no, f.owner_name
    FROM payment_verifications pv
    JOIN flats f ON f.id = pv.flat_id
    WHERE pv.flat_id = ?
    ORDER BY pv.created_at DESC
  `).all(req.user.flat_id || 0);
  res.json(rows);
});

// ── Admin: Get all verifications ─────────────────────────────────────────────
router.get('/', adminOnly, (req, res) => {
  const { status } = req.query;
  const filter = status ? 'WHERE pv.status = ?' : '';
  const params = status ? [status] : [];
  const rows = db.prepare(`
    SELECT pv.*, f.flat_no, f.owner_name, f.mobile
    FROM payment_verifications pv
    JOIN flats f ON f.id = pv.flat_id
    ${filter}
    ORDER BY pv.created_at DESC
  `).all(...params);
  res.json(rows);
});

// ── Admin: Verify → auto mark payment as paid ────────────────────────────────
router.put('/:id/verify', adminOnly, (req, res) => {
  const v = db.prepare('SELECT * FROM payment_verifications WHERE id = ?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Not found' });

  const doVerify = db.transaction(() => {
    // Mark verification as verified
    db.prepare(`UPDATE payment_verifications
      SET status='verified', verified_by=?, verified_at=datetime('now'), note=?
      WHERE id=?
    `).run(req.user.username, req.body.note || '', v.id);

    // Auto-create/update maintenance payment as PAID
    db.prepare(`
      INSERT INTO maintenance_payments
        (flat_id, year, month, amount, status, payment_date, payment_mode)
      VALUES (?, ?, ?, ?, 'paid', date('now'), ?)
      ON CONFLICT(flat_id, year, month) DO UPDATE SET
        amount=excluded.amount, status='paid',
        payment_date=excluded.payment_date, payment_mode=excluded.payment_mode
    `).run(v.flat_id, v.year, v.month, v.amount, v.payment_mode);
  });

  doVerify();
  res.json({ message: 'Payment verified and marked as paid! ✅' });
});

// ── Admin: Reject ────────────────────────────────────────────────────────────
router.put('/:id/reject', adminOnly, (req, res) => {
  db.prepare(`UPDATE payment_verifications
    SET status='rejected', verified_by=?, verified_at=datetime('now'), note=?
    WHERE id=?
  `).run(req.user.username, req.body.note || '', req.params.id);
  res.json({ message: 'Payment rejected' });
});

// ── Admin: Stats ─────────────────────────────────────────────────────────────
router.get('/stats', adminOnly, (req, res) => {
  const stats = db.prepare(`
    SELECT
      SUM(CASE WHEN status='pending'  THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status='verified' THEN 1 ELSE 0 END) as verified,
      SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) as rejected
    FROM payment_verifications
  `).get();
  res.json(stats);
});

module.exports = router;
