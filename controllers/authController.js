const { nanoid } = require('nanoid');
const db = require('../models/db');

exports.login = (req, res) => {
  const { email } = req.body || {};
  // login “fake” (cria user se não existir)
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  let user = u;
  if (!u) {
    const id = nanoid();
    db.prepare('INSERT INTO users(id,email,password) VALUES(?,?,?)')
      .run(id, email || `user_${id}@lab`, 'lab');
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }
  res.cookie('uid', user.id, { httpOnly: true });
  return res.status(200).json({ ok: true, userId: user.id });
};

exports.logout = (_req, res) => {
  res.clearCookie('uid');
  res.status(204).end();
};
