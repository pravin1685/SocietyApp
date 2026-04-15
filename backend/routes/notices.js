const express = require('express');
const { db } = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET active notices (all users)
router.get('/', (req, res) => {
  const now = new Date().toISOString();
  const notices = db.prepare(`
    SELECT * FROM notices
    WHERE active = 1 AND (expires_at IS NULL OR expires_at = '' OR expires_at > ?)
    ORDER BY
      CASE priority WHEN 'urgent' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
      created_at DESC
  `).all(now);
  res.json(notices);
});

// GET all notices (admin)
router.get('/all', adminOnly, (req, res) => {
  const notices = db.prepare('SELECT * FROM notices ORDER BY created_at DESC').all();
  res.json(notices);
});

// POST create notice (admin)
router.post('/', adminOnly, (req, res) => {
  const { title, body, priority, expires_at } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });
  const result = db.prepare(
    'INSERT INTO notices (title, body, priority, expires_at) VALUES (?,?,?,?)'
  ).run(title, body, priority || 'normal', expires_at || null);
  res.json({ id: result.lastInsertRowid, message: 'Notice created' });
});

// PUT update notice (admin)
router.put('/:id', adminOnly, (req, res) => {
  const { title, body, priority, active, expires_at } = req.body;
  db.prepare('UPDATE notices SET title=?, body=?, priority=?, active=?, expires_at=? WHERE id=?')
    .run(title, body, priority || 'normal', active !== undefined ? active : 1, expires_at || null, req.params.id);
  res.json({ message: 'Notice updated' });
});

// DELETE notice (admin)
router.delete('/:id', adminOnly, (req, res) => {
  db.prepare('DELETE FROM notices WHERE id=?').run(req.params.id);
  res.json({ message: 'Notice deleted' });
});

module.exports = router;
