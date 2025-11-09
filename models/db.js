const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'shop.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password TEXT
);
CREATE TABLE IF NOT EXISTS products(
  id TEXT PRIMARY KEY,
  name TEXT,
  price REAL
);
CREATE TABLE IF NOT EXISTS orders(
  id TEXT PRIMARY KEY,
  userId TEXT,
  total REAL,
  createdAt TEXT
);
`);

module.exports = db;
