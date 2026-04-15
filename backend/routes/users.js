const express = require('express');
const { db } = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const router = express.Router();
router.use(authMiddleware);
router.use(adminOnly);

// GET all users with flat info
router.get('/', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.name, u.role, u.flat_id, u.created_at,
           f.flat_no, f.owner_name, f.mobile
    FROM users u
    LEFT JOIN flats f ON u.flat_id = f.id
    ORDER BY u.role DESC, f.flat_no
  `).all();
  res.json(users);
});

// GET single user
router.get('/:id', (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.username, u.name, u.role, u.flat_id, u.created_at,
           f.flat_no, f.owner_name
    FROM users u LEFT JOIN flats f ON u.flat_id = f.id
    WHERE u.id = ?
  `).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// CREATE new user
router.post('/', (req, res) => {
  const { username, name, password, role, flat_id } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });

  const hashed = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare(
      'INSERT INTO users (username, name, password, role, flat_id) VALUES (?,?,?,?,?)'
    ).run(username.trim().toLowerCase(), name || username, hashed, role || 'user', flat_id || null);
    res.json({ id: result.lastInsertRowid, message: 'User created successfully' });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: e.message });
  }
});

// UPDATE user details (name, username, role, flat_id)
router.put('/:id', (req, res) => {
  const { username, name, role, flat_id } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Prevent changing admin role if only one admin
  if (user.role === 'admin' && role === 'user') {
    const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='admin'").get().c;
    if (adminCount <= 1) return res.status(400).json({ error: 'Cannot demote the only admin' });
  }

  try {
    db.prepare('UPDATE users SET username=?, name=?, role=?, flat_id=? WHERE id=?')
      .run(
        (username || user.username).trim().toLowerCase(),
        name || user.name,
        role || user.role,
        flat_id !== undefined ? (flat_id || null) : user.flat_id,
        req.params.id
      );
    res.json({ message: 'User updated successfully' });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already exists' });
    res.status(500).json({ error: e.message });
  }
});

// RESET password to default (username@123)
router.post('/:id/reset-password', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const defaultPwd = user.username + '@123';
  const hashed = bcrypt.hashSync(defaultPwd, 10);
  db.prepare('UPDATE users SET password=? WHERE id=?').run(hashed, req.params.id);
  res.json({ message: 'Password reset to default', defaultPassword: defaultPwd });
});

// SET custom password
router.put('/:id/password', (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  const hashed = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password=? WHERE id=?').run(hashed, req.params.id);
  res.json({ message: 'Password changed successfully' });
});

// DELETE user (cannot delete admin)
router.delete('/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin') return res.status(403).json({ error: 'Cannot delete admin account' });

  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ message: 'User deleted successfully' });
});

// BULK reset all user passwords to default
router.post('/bulk/reset-all', (req, res) => {
  const users = db.prepare("SELECT id, username FROM users WHERE role='user'").all();
  const resetAll = db.transaction(() => {
    for (const u of users) {
      const hashed = bcrypt.hashSync(u.username + '@123', 10);
      db.prepare('UPDATE users SET password=? WHERE id=?').run(hashed, u.id);
    }
  });
  resetAll();
  res.json({ message: `${users.length} users reset to default passwords` });
});

module.exports = router;
