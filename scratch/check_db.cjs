const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/financedb.sqlite');
const db = new Database(dbPath, { readonly: true });

// Check what countries ETFs have
const etfCountries = db.prepare("SELECT country, COUNT(*) as count FROM assets WHERE asset_type = 'ETF' GROUP BY country").all();
console.log('ETF Countries:', etfCountries);

// Check what asset types are in the US
const usAssets = db.prepare("SELECT asset_type, COUNT(*) as count FROM assets WHERE country = 'United States' GROUP BY asset_type").all();
console.log('US Assets:', usAssets);
