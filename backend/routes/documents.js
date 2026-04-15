const express = require('express');
const { db } = require('../database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// GET all documents (list only, no filedata)
router.get('/', (req, res) => {
  const { category } = req.query;
  const where = category ? 'WHERE category = ?' : '';
  const docs = db.prepare(
    `SELECT id, title, category, filename, mimetype, filesize, uploaded_by, created_at FROM documents ${where} ORDER BY created_at DESC`
  ).all(...(category ? [category] : []));
  res.json(docs);
});

// GET download a document
router.get('/:id/download', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const buffer = Buffer.from(doc.filedata, 'base64');
  res.setHeader('Content-Type', doc.mimetype || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
  res.send(buffer);
});

// POST upload document (admin only) — base64 encoded body
router.post('/', adminOnly, (req, res) => {
  const { title, category, filename, mimetype, filedata } = req.body;
  if (!title || !filename || !filedata) return res.status(400).json({ error: 'title, filename and filedata required' });

  // Check size
  const sizeBytes = Math.round((filedata.length * 3) / 4);
  if (sizeBytes > MAX_SIZE_BYTES) return res.status(400).json({ error: `File too large. Max ${MAX_SIZE_MB}MB` });

  const result = db.prepare(
    'INSERT INTO documents (title, category, filename, mimetype, filedata, filesize, uploaded_by) VALUES (?,?,?,?,?,?,?)'
  ).run(title, category || 'general', filename, mimetype || 'application/pdf', filedata, sizeBytes, 'admin');
  res.json({ id: result.lastInsertRowid, message: 'Document uploaded' });
});

// DELETE document (admin only)
router.delete('/:id', adminOnly, (req, res) => {
  db.prepare('DELETE FROM documents WHERE id=?').run(req.params.id);
  res.json({ message: 'Document deleted' });
});

module.exports = router;
