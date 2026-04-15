// Run once: node seed-shops.js
// Adds all 14 shops + their 2024 maintenance data to the local DB

const { db, initDB } = require('./database');
initDB();

const shops = [
  { sl_no: 37, flat_no: 'SHOP-3',  owner_name: 'दिपक जगदाळे',              is_rented: 1 },
  { sl_no: 38, flat_no: 'SHOP-4',  owner_name: 'सुवर्णा श्रीकांत शेडगे',   is_rented: 1 },
  { sl_no: 39, flat_no: 'SHOP-5',  owner_name: 'संतोष संभाजी डांगे',        is_rented: 1 },
  { sl_no: 40, flat_no: 'SHOP-6',  owner_name: 'सुरज बाळु जाधव',            is_rented: 1 },
  { sl_no: 41, flat_no: 'SHOP-7',  owner_name: 'अहमद मजनू पठाण',            is_rented: 1 },
  { sl_no: 42, flat_no: 'SHOP-8',  owner_name: 'गणेश बबन नाळे',             is_rented: 1 },
  { sl_no: 43, flat_no: 'SHOP-9',  owner_name: 'गणेश बबन नाळे',             is_rented: 1 },
  { sl_no: 44, flat_no: 'SHOP-10', owner_name: 'रुपाली जयवंत कदम',          is_rented: 1 },
  { sl_no: 45, flat_no: 'SHOP-11', owner_name: 'दिलावर आतार',               is_rented: 1 },
  { sl_no: 46, flat_no: 'SHOP-12', owner_name: 'विजया मोहिते',               is_rented: 1 },
  { sl_no: 47, flat_no: 'SHOP-13', owner_name: 'तानाजी विठोबा धोत्रे',      is_rented: 1 },
  { sl_no: 48, flat_no: 'SHOP-14', owner_name: 'अविनाश विश्वनाथ मुळीक',     is_rented: 1 },
  { sl_no: 49, flat_no: 'SHOP-15', owner_name: 'दिलावर आतार',               is_rented: 1 },
  { sl_no: 50, flat_no: 'SHOP-16', owner_name: 'चंद्रशेखर पोपट लांभाते',   is_rented: 1 },
  { sl_no: 51, flat_no: 'SHOP-17', owner_name: 'रुपेश मानसिंग भोसले',       is_rented: 1 },
];

// Payments: month → amount (null = pending)
const shopPayments2024 = {
  'SHOP-3':  { 1:null, 2:null, 3:null, 4:null },
  'SHOP-4':  { 1:null, 2:null, 3:null, 4:null },
  'SHOP-5':  { 1:null, 2:null, 3:null, 4:null },
  'SHOP-6':  { 1:150,  2:150,  3:null, 4:null },
  'SHOP-7':  { 1:null, 2:null, 3:null, 4:null },
  'SHOP-8':  { 1:150,  2:150,  3:null, 4:null },
  'SHOP-9':  { 1:null, 2:null, 3:null, 4:null },
  'SHOP-10': { 1:150,  2:150,  3:null, 4:null },
  'SHOP-11': { 1:150,  2:150,  3:null, 4:null },
  'SHOP-12': { 1:null, 2:null, 3:null, 4:null },
  'SHOP-13': { 1:150,  2:150,  3:null, 4:null },
  'SHOP-14': { 1:null, 2:null, 3:null, 4:null },
  'SHOP-15': { 1:150,  2:150,  3:null, 4:null },
  'SHOP-16': { 1:150,  2:150,  3:null, 4:null },
  'SHOP-17': { 1:150,  2:150,  3:null, 4:null },
};

const seedAll = db.transaction(() => {
  // Update shop_rate for all years
  db.prepare(`UPDATE maintenance_rates SET shop_rate = 150`).run();

  const insFlat = db.prepare(`
    INSERT OR IGNORE INTO flats (sl_no, flat_no, owner_name, tenant_name, mobile, is_rented, is_shop)
    VALUES (?, ?, ?, '', '', ?, 1)
  `);
  const insPmt = db.prepare(`
    INSERT OR IGNORE INTO maintenance_payments (flat_id, year, month, amount, status)
    VALUES (?, 2024, ?, ?, ?)
  `);

  let added = 0, pmts = 0;
  for (const shop of shops) {
    const exists = db.prepare('SELECT id FROM flats WHERE flat_no = ?').get(shop.flat_no);
    if (!exists) {
      insFlat.run(shop.sl_no, shop.flat_no, shop.owner_name, shop.is_rented);
      added++;
    }
    const flat = db.prepare('SELECT id FROM flats WHERE flat_no = ?').get(shop.flat_no);
    if (!flat) continue;

    const months = shopPayments2024[shop.flat_no] || {};
    for (const [month, amount] of Object.entries(months)) {
      insPmt.run(flat.id, +month, amount || 0, amount ? 'paid' : 'pending');
      pmts++;
    }
  }
  console.log(`✅ Shops added: ${added}, Payments seeded: ${pmts}`);
});

seedAll();
process.exit(0);
