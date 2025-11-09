const { nanoid } = require('nanoid');
const db = require('../models/db');

exports.list = (_req, res) => {
  const rows = db.prepare('SELECT id,name,price FROM products').all();
  return res.json(rows);
};

exports.seed = (_req, res) => {
  const count = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  if (count === 0) {
    const ins = db.prepare('INSERT INTO products(id,name,price) VALUES(?,?,?)');
    for (let i = 1; i <= 8; i++) ins.run(nanoid(), `Produto ${i}`, 10 * i);
  }
  return res.json({ seeded: true });
};
