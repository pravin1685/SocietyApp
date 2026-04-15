const express = require('express');
const { db } = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/summary', (req, res) => {
  const year = req.query.year || new Date().getFullYear();

  let flatFilter = '';
  const params = [year];

  if (req.user.role !== 'admin') {
    flatFilter = 'AND mp.flat_id = ?';
    params.push(req.user.flat_id);
  }

  const maintenance = db.prepare(`
    SELECT
      SUM(CASE WHEN mp.status='paid' THEN mp.amount ELSE 0 END) as total_collected,
      SUM(CASE WHEN mp.status='pending' THEN 1 ELSE 0 END) as pending_count,
      COUNT(mp.id) as total_entries
    FROM maintenance_payments mp WHERE mp.year=? ${flatFilter}
  `).get(...params);

  const outstanding = db.prepare(`
    SELECT SUM(od.total_outstanding) as total_outstanding, COUNT(od.id) as flat_count
    FROM outstanding_dues od WHERE od.year=? ${req.user.role !== 'admin' ? 'AND od.flat_id=?' : ''}
  `).get(...(req.user.role !== 'admin' ? [year, req.user.flat_id] : [year]));

  const ledger = db.prepare(`
    SELECT
      SUM(CASE WHEN type='receipt' THEN amount ELSE 0 END) as total_receipts,
      SUM(CASE WHEN type='payment' THEN amount ELSE 0 END) as total_payments
    FROM ledger_entries WHERE year=?
  `).get(year);

  const monthly = db.prepare(`
    SELECT month,
      SUM(CASE WHEN type='receipt' THEN amount ELSE 0 END) as receipts,
      SUM(CASE WHEN type='payment' THEN amount ELSE 0 END) as payments
    FROM ledger_entries WHERE year=?
    GROUP BY month ORDER BY month
  `).all(year);

  const flatStats = req.user.role === 'admin' ? db.prepare(`
    SELECT
      COUNT(*) as total_flats,
      SUM(CASE WHEN is_rented=1 THEN 1 ELSE 0 END) as rented,
      SUM(CASE WHEN is_rented=0 THEN 1 ELSE 0 END) as owner_occupied
    FROM flats
  `).get() : null;

  res.json({ maintenance, outstanding, ledger, monthly, flatStats, year });
});

module.exports = router;
