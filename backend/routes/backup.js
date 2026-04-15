const express = require('express');
const { db } = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);
router.use(adminOnly);

// ── EXPORT: full DB as JSON ──────────────────────────────────────────────────
router.get('/export', (req, res) => {
  try {
    const data = {
      version: 1,
      exported_at: new Date().toISOString(),
      flats:               db.prepare('SELECT * FROM flats').all(),
      maintenance_rates:   db.prepare('SELECT * FROM maintenance_rates').all(),
      maintenance_payments:db.prepare('SELECT * FROM maintenance_payments').all(),
      outstanding_dues:    db.prepare('SELECT * FROM outstanding_dues').all(),
      ledger_entries:      db.prepare('SELECT * FROM ledger_entries').all(),
      settings:            db.prepare('SELECT * FROM settings').all(),
      notices:             db.prepare('SELECT * FROM notices').all(),
      documents:           db.prepare('SELECT id, title, category, filename, mimetype, filesize, uploaded_by, created_at FROM documents').all(),
    };
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── IMPORT: restore from JSON ────────────────────────────────────────────────
router.post('/restore', (req, res) => {
  const data = req.body;
  if (!data || !data.flats) return res.status(400).json({ error: 'Invalid backup file' });

  try {
    const restore = db.transaction(() => {
      // Clear existing data (keep users)
      db.exec(`
        DELETE FROM maintenance_payments;
        DELETE FROM outstanding_dues;
        DELETE FROM ledger_entries;
        DELETE FROM maintenance_rates;
        DELETE FROM flats;
        DELETE FROM settings;
        DELETE FROM notices;
      `);

      // Restore flats
      const insFlat = db.prepare(`INSERT OR IGNORE INTO flats
        (id, sl_no, flat_no, owner_name, tenant_name, mobile, is_rented, created_at)
        VALUES (@id, @sl_no, @flat_no, @owner_name, @tenant_name, @mobile, @is_rented, @created_at)`);
      (data.flats || []).forEach(r => insFlat.run(r));

      // Restore rates
      const insRate = db.prepare(`INSERT OR IGNORE INTO maintenance_rates
        (id, year, without_noc, with_noc, empty_flat)
        VALUES (@id, @year, @without_noc, @with_noc, @empty_flat)`);
      (data.maintenance_rates || []).forEach(r => insRate.run(r));

      // Restore payments
      const insPmt = db.prepare(`INSERT OR IGNORE INTO maintenance_payments
        (id, flat_id, year, month, amount, status, payment_date, payment_mode, month_occupancy, created_at)
        VALUES (@id, @flat_id, @year, @month, @amount, @status, @payment_date, @payment_mode, @month_occupancy, @created_at)`);
      (data.maintenance_payments || []).forEach(r => insPmt.run(r));

      // Restore outstanding
      const insOut = db.prepare(`INSERT OR IGNORE INTO outstanding_dues
        (id, flat_id, year, maintenance_outstanding, audit_fee, three_phase_motor,
         conveyance_deed_fee, toilet_tank_cleaning, other_charges, total_outstanding, remark)
        VALUES (@id, @flat_id, @year, @maintenance_outstanding, @audit_fee, @three_phase_motor,
         @conveyance_deed_fee, @toilet_tank_cleaning, @other_charges, @total_outstanding, @remark)`);
      (data.outstanding_dues || []).forEach(r => insOut.run(r));

      // Restore ledger
      const insLedger = db.prepare(`INSERT OR IGNORE INTO ledger_entries
        (id, year, month, entry_date, voucher_no, type, details, payment_mode, amount, created_at)
        VALUES (@id, @year, @month, @entry_date, @voucher_no, @type, @details, @payment_mode, @amount, @created_at)`);
      (data.ledger_entries || []).forEach(r => insLedger.run(r));

      // Restore settings
      const insSetting = db.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES (@key, @value, @updated_at)`);
      (data.settings || []).forEach(r => insSetting.run(r));

      // Restore notices
      const insNotice = db.prepare(`INSERT OR IGNORE INTO notices
        (id, title, body, priority, active, expires_at, created_at)
        VALUES (@id, @title, @body, @priority, @active, @expires_at, @created_at)`);
      (data.notices || []).forEach(r => insNotice.run(r));
    });

    restore();
    res.json({ message: 'Restore successful!', stats: {
      flats: data.flats?.length || 0,
      payments: data.maintenance_payments?.length || 0,
      ledger: data.ledger_entries?.length || 0,
    }});
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
