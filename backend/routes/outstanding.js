const express = require('express');
const { db } = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const { year } = req.query;

  let flatFilter = '';
  const params = [];
  if (req.user.role !== 'admin') {
    flatFilter = 'AND od.flat_id = ?';
    params.push(req.user.flat_id);
  }
  if (year) params.push(year);

  const rows = db.prepare(`
    SELECT od.*, f.flat_no, f.owner_name, f.tenant_name
    FROM outstanding_dues od
    JOIN flats f ON f.id = od.flat_id
    WHERE 1=1 ${flatFilter} ${year ? 'AND od.year = ?' : ''}
    ORDER BY f.sl_no, od.year
  `).all(...params);
  res.json(rows);
});

router.post('/', adminOnly, (req, res) => {
  const { flat_id, year, maintenance_outstanding, audit_fee, three_phase_motor, conveyance_deed_fee, toilet_tank_cleaning, other_charges, remark } = req.body;
  const total = (maintenance_outstanding || 0) + (audit_fee || 0) + (three_phase_motor || 0) + (conveyance_deed_fee || 0) + (toilet_tank_cleaning || 0) + (other_charges || 0);
  db.prepare(`
    INSERT INTO outstanding_dues
      (flat_id, year, maintenance_outstanding, audit_fee, three_phase_motor, conveyance_deed_fee, toilet_tank_cleaning, other_charges, total_outstanding, remark)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(flat_id, year) DO UPDATE SET
      maintenance_outstanding=excluded.maintenance_outstanding, audit_fee=excluded.audit_fee,
      three_phase_motor=excluded.three_phase_motor, conveyance_deed_fee=excluded.conveyance_deed_fee,
      toilet_tank_cleaning=excluded.toilet_tank_cleaning, other_charges=excluded.other_charges,
      total_outstanding=excluded.total_outstanding, remark=excluded.remark
  `).run(flat_id, year, maintenance_outstanding || 0, audit_fee || 0, three_phase_motor || 0, conveyance_deed_fee || 0, toilet_tank_cleaning || 0, other_charges || 0, total, remark || '');
  res.json({ message: 'Outstanding saved' });
});

router.put('/:id', adminOnly, (req, res) => {
  const { maintenance_outstanding, audit_fee, three_phase_motor, conveyance_deed_fee, toilet_tank_cleaning, other_charges, remark } = req.body;
  const total = (maintenance_outstanding || 0) + (audit_fee || 0) + (three_phase_motor || 0) + (conveyance_deed_fee || 0) + (toilet_tank_cleaning || 0) + (other_charges || 0);
  db.prepare(`
    UPDATE outstanding_dues SET
      maintenance_outstanding=?, audit_fee=?, three_phase_motor=?, conveyance_deed_fee=?,
      toilet_tank_cleaning=?, other_charges=?, total_outstanding=?, remark=?
    WHERE id=?
  `).run(maintenance_outstanding || 0, audit_fee || 0, three_phase_motor || 0, conveyance_deed_fee || 0, toilet_tank_cleaning || 0, other_charges || 0, total, remark || '', req.params.id);
  res.json({ message: 'Outstanding updated' });
});

module.exports = router;
