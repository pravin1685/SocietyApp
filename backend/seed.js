const XLSX = require('xlsx');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db, initDB } = require('./database');

const EXCEL_PATH = path.join('C:\\Users\\Pravin Lonkar\\Downloads\\Central Park Maintenance.xlsx');

function cellVal(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function numVal(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function seedFlats(wb) {
  const ws = wb.Sheets['Name_Master'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const insertFlat = db.prepare(`
    INSERT OR IGNORE INTO flats (sl_no, flat_no, owner_name, tenant_name, mobile, is_rented)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (username, password, role, flat_id, name)
    VALUES (?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const slNo = numVal(row[0]);
    const flatNo = cellVal(row[1]);
    const ownerName = cellVal(row[2]);
    const tenant = cellVal(row[3]);
    const mobile = cellVal(row[4]);

    if (!flatNo || !flatNo.startsWith('FLAT')) continue;

    const isRented = tenant ? 1 : 0;
    insertFlat.run(slNo, flatNo, ownerName || flatNo, tenant, mobile, isRented);

    const flat = db.prepare('SELECT id FROM flats WHERE flat_no = ?').get(flatNo);
    if (flat) {
      const username = flatNo.toLowerCase().replace('-', '');
      const password = bcrypt.hashSync(username + '@123', 10);
      insertUser.run(username, password, 'user', flat.id, ownerName || flatNo);
      count++;
    }
  }
  console.log(`Seeded ${count} flats`);
}

function seedMaintenance(wb) {
  const years = [
    { sheet: 'MaintenanceCollection2023', year: 2023 },
    { sheet: 'MaintenanceCollection2024', year: 2024 },
    { sheet: 'MaintenanceCollection2025', year: 2025 },
  ];

  const upsert = db.prepare(`
    INSERT INTO maintenance_payments (flat_id, year, month, amount, status, payment_date)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(flat_id, year, month) DO UPDATE SET
      amount = excluded.amount, status = excluded.status
  `);

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  for (const { sheet, year } of years) {
    const ws = wb.Sheets[sheet];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    let headerRow = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].includes('Flat No') || rows[i].includes('Flat No.')) {
        headerRow = i;
        break;
      }
    }
    if (headerRow === -1) continue;

    const headers = rows[headerRow].map(h => cellVal(h));
    // Dynamically find which column has 'Flat No' header to handle different sheet layouts
    const flatNoCol = headers.findIndex(h => h === 'Flat No' || h === 'Flat No.');
    if (flatNoCol === -1) { console.log(`No Flat No column in ${sheet}`); continue; }

    const monthCols = {};
    MONTHS.forEach((m, idx) => {
      const ci = headers.findIndex(h => h === m);
      if (ci !== -1) monthCols[idx + 1] = ci;
    });

    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i];
      const flatNo = cellVal(row[flatNoCol]);
      if (!flatNo.startsWith('FLAT')) continue;

      const flat = db.prepare('SELECT id FROM flats WHERE flat_no = ?').get(flatNo);
      if (!flat) continue;

      for (const [month, col] of Object.entries(monthCols)) {
        const raw = cellVal(row[col]);
        if (!raw) continue;
        const isPending = raw.toLowerCase() === 'pending';
        const amount = isPending ? 0 : numVal(raw);
        const status = isPending ? 'pending' : (amount > 0 ? 'paid' : 'pending');
        upsert.run(flat.id, year, parseInt(month), amount, status, null);
      }
    }
    console.log(`Seeded maintenance ${year}`);
  }
}

function seedOutstanding(wb) {
  const sheets = [
    { sheet: 'TotalOutSatanding2023', year: 2023 },
    { sheet: 'TotalOutSatanding2024', year: 2024 },
  ];

  const upsert = db.prepare(`
    INSERT INTO outstanding_dues
      (flat_id, year, maintenance_outstanding, audit_fee, three_phase_motor, conveyance_deed_fee, toilet_tank_cleaning, total_outstanding, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(flat_id, year) DO UPDATE SET
      maintenance_outstanding = excluded.maintenance_outstanding,
      audit_fee = excluded.audit_fee,
      three_phase_motor = excluded.three_phase_motor,
      conveyance_deed_fee = excluded.conveyance_deed_fee,
      toilet_tank_cleaning = excluded.toilet_tank_cleaning,
      total_outstanding = excluded.total_outstanding,
      remark = excluded.remark
  `);

  for (const { sheet, year } of sheets) {
    const ws = wb.Sheets[sheet];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    let dataStart = -1;
    for (let i = 0; i < rows.length; i++) {
      if (cellVal(rows[i][0]) === '1' || (rows[i][1] && cellVal(rows[i][1]).startsWith('FLAT'))) {
        dataStart = i;
        break;
      }
    }
    if (dataStart === -1) dataStart = 2;

    for (let i = dataStart; i < rows.length; i++) {
      const row = rows[i];
      const flatNo = cellVal(row[1]);
      if (!flatNo.startsWith('FLAT')) continue;

      const flat = db.prepare('SELECT id FROM flats WHERE flat_no = ?').get(flatNo);
      if (!flat) continue;

      if (year === 2023) {
        upsert.run(flat.id, year, numVal(row[3]), numVal(row[4]), numVal(row[5]), numVal(row[6]), 0, numVal(row[7]), cellVal(row[8]));
      } else {
        upsert.run(flat.id, year, numVal(row[4]), numVal(row[5]), numVal(row[6]), numVal(row[7]), numVal(row[8]), numVal(row[9]), cellVal(row[10]));
      }
    }
    console.log(`Seeded outstanding ${year}`);
  }
}

function seedLedger(wb) {
  // Always clear before re-seeding to prevent duplicates on subsequent runs
  db.prepare('DELETE FROM ledger_entries').run();

  const sheets = [
    { sheet: 'TotalMaintenance2024', year: 2024 },
    { sheet: 'TotalMaintenance2025', year: 2025 },
  ];

  const insert = db.prepare(`
    INSERT INTO ledger_entries (year, month, entry_date, voucher_no, type, details, payment_mode, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  for (const { sheet, year } of sheets) {
    const ws = wb.Sheets[sheet];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    let currentMonth = 1;
    let inDataSection = false;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Detect month
      for (let col = 0; col < row.length; col++) {
        const v = cellVal(row[col]);
        const mIdx = MONTH_NAMES.indexOf(v);
        if (mIdx !== -1 && col <= 3) {
          currentMonth = mIdx + 1;
        }
      }

      // Actual Excel column layout (society's custom format):
      // col[1]=Sl.No, col[2]=FlatNo/ref, col[3]=PayerName/Description,
      // col[4]=PaymentMode(Cash/UPI), col[5]=Amount, col[6]=unused
      // Similarly for payments: col[7]=Sl.No, col[8]=ref, col[9]=description,
      // col[10]=mode, col[11]=amount, col[12]=unused
      const slNo = cellVal(row[1]);
      if (/^\d+$/.test(slNo)) {
        inDataSection = true;
        // Receipt
        const rcptRef     = cellVal(row[2]);  // Flat No or date ref
        const rcptDetails = cellVal(row[3]);  // Payer name / description
        const rcptMode    = cellVal(row[4]);  // Payment mode: Cash/UPI/etc
        const rcptAmount  = numVal(row[5]);   // Actual rupee amount
        if ((rcptDetails || rcptRef) && rcptAmount > 0) {
          insert.run(year, currentMonth, null, rcptRef, 'receipt', rcptDetails, rcptMode, rcptAmount);
        }
        // Payment
        const pmtRef     = cellVal(row[8]);   // reference
        const pmtDetails = cellVal(row[9]);   // Expense description
        const pmtMode    = cellVal(row[10]);  // Payment mode
        const pmtAmount  = numVal(row[11]);   // Actual rupee amount
        if ((pmtDetails || pmtRef) && pmtAmount > 0) {
          insert.run(year, currentMonth, null, pmtRef, 'payment', pmtDetails, pmtMode, pmtAmount);
        }
      } else if (cellVal(row[4]) === 'Opening Balance') {
        // Opening Balance row: amount is in col[6]
        const amount = numVal(row[6]);
        if (amount > 0) {
          insert.run(year, currentMonth, null, null, 'receipt', 'Opening Balance', '', amount);
        }
      }
    }
    console.log(`Seeded ledger ${year}`);
  }
}

function runSeed() {
  initDB();
  try {
    const wb = XLSX.readFile(EXCEL_PATH);
    console.log('Reading Excel:', EXCEL_PATH);

    const seedAll = db.transaction(() => {
      seedFlats(wb);
      seedMaintenance(wb);
      seedOutstanding(wb);
      seedLedger(wb);
    });

    seedAll();
    console.log('Seed complete!');
  } catch (err) {
    console.error('Seed error:', err.message);
  }
}

runSeed();
