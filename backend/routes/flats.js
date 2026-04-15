const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  if (req.user.role === 'admin') {
    const flats = db.prepare('SELECT * FROM flats ORDER BY sl_no').all();
    res.json(flats);
  } else {
    const flat = db.prepare('SELECT * FROM flats WHERE id = ?').get(req.user.flat_id);
    res.json(flat ? [flat] : []);
  }
});

router.get('/:id', (req, res) => {
  if (req.user.role !== 'admin' && req.user.flat_id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const flat = db.prepare('SELECT * FROM flats WHERE id = ?').get(req.params.id);
  if (!flat) return res.status(404).json({ error: 'Flat not found' });
  res.json(flat);
});

router.post('/', adminOnly, (req, res) => {
  const { sl_no, flat_no, owner_name, tenant_name, mobile, is_rented } = req.body;
  if (!flat_no || !owner_name) return res.status(400).json({ error: 'flat_no and owner_name required' });

  try {
    const result = db.prepare(
      'INSERT INTO flats (sl_no, flat_no, owner_name, tenant_name, mobile, is_rented) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(sl_no, flat_no, owner_name, tenant_name || '', mobile || '', is_rented || 0);

    const username = flat_no.toLowerCase().replace('-', '');
    const password = bcrypt.hashSync(username + '@123', 10);
    db.prepare('INSERT OR IGNORE INTO users (username, password, role, flat_id, name) VALUES (?, ?, ?, ?, ?)')
      .run(username, password, 'user', result.lastInsertRowid, owner_name);

    res.json({ id: result.lastInsertRowid, message: 'Flat created' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', adminOnly, (req, res) => {
  const { owner_name, tenant_name, mobile, is_rented } = req.body;
  // is_rented: 0=owner, 1=tenant, 2=empty
  const occupancy = parseInt(is_rented) || 0;
  db.prepare(
    'UPDATE flats SET owner_name=?, tenant_name=?, mobile=?, is_rented=? WHERE id=?'
  ).run(owner_name, tenant_name || '', mobile || '', occupancy, req.params.id);

  db.prepare('UPDATE users SET name=? WHERE flat_id=?').run(owner_name, req.params.id);
  res.json({ message: 'Flat updated' });
});

router.delete('/:id', adminOnly, (req, res) => {
  db.prepare('DELETE FROM flats WHERE id=?').run(req.params.id);
  res.json({ message: 'Flat deleted' });
});

module.exports = router;
