const express = require('express');
const { db } = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET all settings (public read – UPI ID needed by users for QR)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const result = {};
  rows.forEach(r => { result[r.key] = r.value; });
  // Never expose bank_qr_raw to non-admin (too large anyway), only expose upi_id, society_name etc.
  if (!req.user || req.user.role !== 'admin') {
    delete result.bank_qr_raw;
  }
  res.json(result);
});

// PUT / upsert a setting (admin only)
router.put('/:key', adminOnly, (req, res) => {
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'value required' });
  db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?,?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`)
    .run(req.params.key, String(value));
  res.json({ message: 'Setting saved' });
});

// PUT multiple settings at once
router.put('/', adminOnly, (req, res) => {
  const upsert = db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?,?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`);
  const saveAll = db.transaction((obj) => {
    for (const [k, v] of Object.entries(obj)) upsert.run(k, String(v));
  });
  saveAll(req.body);
  res.json({ message: 'Settings saved' });
});

module.exports = router;
