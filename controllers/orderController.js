const axios = require('axios');
const { nanoid } = require('nanoid');
const db = require('../models/db');
const { shouldDelay, delayMs, shouldError } = require('./faultController');

exports.checkout = async (req, res) => {
  try {
    if (shouldDelay()) await new Promise(r => setTimeout(r, delayMs()));
    if (shouldError()) return res.status(500).json({ error: 'Falha proposital no checkout' });

    const { uid } = req.cookies || {};
    const items = (req.body && req.body.items) || [];
    const total = items.reduce((a, it) => a + (Number(it.price) || 0), 0);

    // chama o serviço de pagamento (outro processo => outro “service” no Dynatrace)
    const pay = await axios.post(`http://127.0.0.1:3001/pay`, { amount: total, userId: uid || 'guest' }, { timeout: 5000 });

    const id = nanoid();
    db.prepare('INSERT INTO orders(id,userId,total,createdAt) VALUES(?,?,?,datetime("now"))')
      .run(id, uid || 'guest', total);

    return res.json({ ok: true, orderId: id, payment: pay.data });
  } catch (e) {
    return res.status(502).json({ error: 'Erro chamando payment-svc', detail: e.message });
  }
};
