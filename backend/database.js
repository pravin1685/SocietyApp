const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

// Use DB_PATH env var if set, otherwise use app directory
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'society.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      flat_id INTEGER,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS flats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sl_no INTEGER,
      flat_no TEXT UNIQUE NOT NULL,
      owner_name TEXT NOT NULL,
      tenant_name TEXT DEFAULT '',
      mobile TEXT DEFAULT '',
      is_rented INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS maintenance_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL UNIQUE,
      without_noc REAL NOT NULL DEFAULT 250,
      with_noc REAL NOT NULL DEFAULT 500,
      empty_flat REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS maintenance_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flat_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      amount REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      payment_date TEXT,
      payment_mode TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (flat_id) REFERENCES flats(id),
      UNIQUE(flat_id, year, month)
    );

    CREATE TABLE IF NOT EXISTS outstanding_dues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flat_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      maintenance_outstanding REAL DEFAULT 0,
      audit_fee REAL DEFAULT 0,
      three_phase_motor REAL DEFAULT 0,
      conveyance_deed_fee REAL DEFAULT 0,
      toilet_tank_cleaning REAL DEFAULT 0,
      other_charges REAL DEFAULT 0,
      total_outstanding REAL DEFAULT 0,
      remark TEXT DEFAULT '',
      FOREIGN KEY (flat_id) REFERENCES flats(id),
      UNIQUE(flat_id, year)
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      entry_date TEXT,
      voucher_no TEXT DEFAULT '',
      type TEXT NOT NULL,
      details TEXT NOT NULL,
      payment_mode TEXT DEFAULT '',
      amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      priority TEXT DEFAULT 'normal',
      active INTEGER DEFAULT 1,
      expires_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      filename TEXT NOT NULL,
      mimetype TEXT DEFAULT 'application/pdf',
      filedata TEXT NOT NULL,
      filesize INTEGER DEFAULT 0,
      uploaded_by TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin@123', 10);
    db.prepare('INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)').run('admin', hash, 'admin', 'Administrator');
  }

  // ── payment_verifications table ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flat_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      amount REAL NOT NULL,
      utr_number TEXT NOT NULL,
      payment_mode TEXT DEFAULT 'UPI',
      screenshot TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      note TEXT DEFAULT '',
      verified_by TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      verified_at DATETIME,
      FOREIGN KEY (flat_id) REFERENCES flats(id)
    );
  `);

  // Migrate: add empty_flat column if not present (for existing DBs)
  try { db.exec('ALTER TABLE maintenance_rates ADD COLUMN empty_flat REAL NOT NULL DEFAULT 0'); } catch (_) {}
  // Migrate: add month_occupancy to maintenance_payments (NULL = use flat default)
  try { db.exec('ALTER TABLE maintenance_payments ADD COLUMN month_occupancy INTEGER DEFAULT NULL'); } catch (_) {}
  // Migrate: add shop_rate to maintenance_rates
  try { db.exec('ALTER TABLE maintenance_rates ADD COLUMN shop_rate REAL NOT NULL DEFAULT 150'); } catch (_) {}
  // Migrate: add is_shop flag to flats (0=flat, 1=shop)
  try { db.exec('ALTER TABLE flats ADD COLUMN is_shop INTEGER NOT NULL DEFAULT 0'); } catch (_) {}
  // Auto-fix: any flat whose flat_no starts with 'SHOP-' must have is_shop=1
  try { db.exec("UPDATE flats SET is_shop = 1 WHERE flat_no LIKE 'SHOP-%' AND is_shop = 0"); } catch (_) {}

  const ratesStmt = db.prepare('INSERT OR IGNORE INTO maintenance_rates (year, without_noc, with_noc, empty_flat) VALUES (?, ?, ?, ?)');
  [2023, 2024, 2025].forEach(y => ratesStmt.run(y, 250, 500, 0));
}

module.exports = { db, initDB };
