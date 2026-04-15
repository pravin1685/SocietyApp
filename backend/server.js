require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./database');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // allow large base64 uploads

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/notices', require('./routes/notices'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/flats', require('./routes/flats'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/outstanding', require('./routes/outstanding'));
app.use('/api/ledger', require('./routes/ledger'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/backup',        require('./routes/backup'));
app.use('/api/verifications', require('./routes/verifications'));

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

initDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
