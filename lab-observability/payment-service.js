/**
 * payment-service.js
 * - simple mock payment service on port 3001
 * - failure rate controlled via ENV PAY_ERROR_RATE or DB faults table
 * - writes to /var/log/lab-observability/pay.log
 */

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const LOG_DIR = '/var/log/lab-observability';
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const payLog = path.join(LOG_DIR, 'pay.log');

function log(obj) {
  fs.appendFileSync(payLog, JSON.stringify(obj) + '\n');
}

function db() {
  return new sqlite3.Database(path.join(__dirname, 'data', 'app.db'));
}

const app = express();
app.use(bodyParser.json());

app.post('/pay', (req,res) => {
  const { user, total_cents } = req.body;
  const baseRate = parseFloat(process.env.PAY_ERROR_RATE || '0'); // 0..1
  // inspect DB faults
  const conn = db();
  conn.get("SELECT params_json FROM faults WHERE name='pay_error_rate' ORDER BY id DESC LIMIT 1", [], (err, row) => {
    let dbRate = 0;
    if (row && row.params_json) {
      try { dbRate = JSON.parse(row.params_json).rate || 0; } catch(e){}
    }
    conn.close();
    const finalRate = Math.max(baseRate, dbRate || 0);
    const rnd = Math.random();
    const ts = new Date().toISOString();
    if (rnd < finalRate) {
      const errObj = { ts, service:'pay', level:'error', message:'payment failed simulated', user, total_cents, status:502 };
      log(errObj);
      res.json({ ok:false, error: 'simulated_fail' });
    } else {
      const providerRef = 'PAY-' + (Math.floor(Math.random() * 1e9));
      log({ ts, service:'pay', level:'info', message:'payment success', user, total_cents, providerRef });
      res.json({ ok:true, auth: { provider: 'labpay', ref: providerRef }, orderId: providerRef });
    }
  });
});

const PORT = process.env.PAY_PORT || 3001;
app.listen(PORT, () => {
  console.log(`payment mock listening ${PORT}`);
  log({ ts: new Date().toISOString(), service:'pay', level:'info', message:'started', port: PORT });
});
