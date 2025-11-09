const express = require('express');
const body = require('body-parser');
const morgan = require('morgan');

// opcional: tenta SDK
try { require('dynatrace-oneagent-sdk'); } catch {}

const app = express();
app.use(morgan('combined'));
app.use(body.json());

app.post('/pay', (req, res) => {
  const { amount, userId } = req.body || {};
  // simula latência do gateway
  const ms = 300 + Math.floor(Math.random() * 400);
  setTimeout(() => {
    if (Math.random() < 0.05) return res.status(502).json({ ok: false, code: 'GATEWAY_DOWN' });
    res.json({ ok: true, authCode: 'AUTH' + Math.floor(Math.random() * 1e6), amount, userId });
  }, ms);
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(3001, '127.0.0.1', () => console.log('payment-svc on 3001'));
