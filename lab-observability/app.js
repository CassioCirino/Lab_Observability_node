/**
 * app.js - main web + api server (port 3000)
 * - serves frontend pages (public/)
 * - provides REST API for products, cart, checkout
 * - communicates with payment service at localhost:3001
 * - writes JSON line logs to /var/log/lab-observability/app.log
 * - vulnerable endpoint /api/user/search when ENABLE_VULN=true
 */

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const crypto = require('crypto');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fetch = require('node-fetch'); // Node 20 includes fetch but ok to reference
const { openDb } = require('./db');

const LOG_DIR = '/var/log/lab-observability';
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const appLog = path.join(LOG_DIR, 'app.log');

function log(obj) {
  const line = JSON.stringify(obj, null, 0);
  fs.appendFileSync(appLog, line + '\n');
}

const ENABLE_VULN = process.env.ENABLE_VULN === 'true' ? true : false;
const DTRUM_SNIPPET = process.env.DTRUM_SNIPPET || '';

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(require('cookie-parser')());
app.use(session({
  secret: process.env.SESSION_SECRET || 'lab_secret_please_change',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24*3600*1000 }
}));

// serve static public folder
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// inject RUM snippet if set
app.get('/', (req, res) => {
  const file = path.join(__dirname, 'public', 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  if (DTRUM_SNIPPET) {
    html = html.replace('<!-- DTRUM_SNIPPET -->', DTRUM_SNIPPET);
  }
  res.send(html);
});

app.get('/product/:slug', (req, res) => {
  const file = path.join(__dirname, 'public', 'product.html');
  let html = fs.readFileSync(file, 'utf8');
  if (DTRUM_SNIPPET) html = html.replace('<!-- DTRUM_SNIPPET -->', DTRUM_SNIPPET);
  res.send(html);
});

app.get('/login', (req, res) => {
  let html = fs.readFileSync(path.join(__dirname, 'public', 'login.html'), 'utf8');
  if (DTRUM_SNIPPET) html = html.replace('<!-- DTRUM_SNIPPET -->', DTRUM_SNIPPET);
  res.send(html);
});

app.get('/order/:id', (req,res) => {
  res.send(fs.readFileSync(path.join(__dirname,'public','order.html'),'utf8'));
});

app.get('/health', (req, res) => res.json({ ok:true, app:'web', version: process.env.BUILD_SHA || 'dev' }));

// API
const DBFILE = path.join(__dirname, 'data', 'app.db');
function db() {
  return new sqlite3.Database(DBFILE);
}

app.get('/api/products', (req, res) => {
  const q = 'SELECT id,name,slug,description,image_url,price_cents,stock,category FROM products';
  const conn = db();
  conn.all(q, [], (err, rows) => {
    conn.close();
    if (err) {
      log({ ts: new Date().toISOString(), service:'web', route:'/api/products', level:'error', message: err.message });
      return res.status(500).json({ error: 'db' });
    }
    res.json(rows);
  });
});

app.get('/api/products/:slug', (req, res) => {
  const slug = req.params.slug;
  const conn = db();
  conn.get('SELECT * FROM products WHERE slug = ?', [slug], (err, row) => {
    conn.close();
    if (err) {
      log({ ts: new Date().toISOString(), service:'web', route:'/api/products/:slug', level:'error', message: err.message });
      return res.status(500).json({ error: 'db' });
    }
    res.json(row || {});
  });
});

app.post('/api/register', async (req,res) => {
  const { username, email, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'invalid' });
  const hash = await bcrypt.hash(password, 10);
  const conn = db();
  conn.run('INSERT INTO users(username,email,password_hash,role,created_at,updated_at) VALUES (?,?,?,?,datetime("now"),datetime("now"))', [username,email,hash,'user'], function(err) {
    conn.close();
    if (err) {
      log({ ts:new Date().toISOString(), service:'web', route:'/api/register', level:'error', message:err.message, user:username });
      return res.status(500).json({ error:'db' });
    }
    req.session.userId = this.lastID;
    req.session.username = username;
    res.json({ ok:true, id: this.lastID });
  });
});

app.post('/api/login', (req,res) => {
  const { username, password } = req.body;
  const conn = db();
  conn.get('SELECT * FROM users WHERE username = ?', [username], async (err,row) => {
    conn.close();
    if (err || !row) {
      return res.status(401).json({ error:'invalid' });
    }
    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) return res.status(401).json({ error:'invalid' });
    req.session.userId = row.id;
    req.session.username = row.username;
    req.session.role = row.role;
    res.json({ ok:true, user: { id: row.id, username: row.username, role: row.role }});
  });
});

function ensureAuth(req,res,next){
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error:'unauth' });
}

function ensureAdmin(req,res,next){
  if (req.session && req.session.role === 'admin') return next();
  return res.status(403).json({ error:'forbidden' });
}

app.post('/api/cart/add', ensureAuth, (req,res) => {
  const { productId, qty } = req.body;
  const userId = req.session.userId;
  const conn = db();
  conn.serialize(() => {
    conn.get('SELECT id FROM carts WHERE user_id = ? AND status = "open"', [userId], (err, cart) => {
      const upsertCart = (cartId) => {
        conn.get('SELECT price_cents,stock FROM products WHERE id = ?', [productId], (err, p) => {
          if (!p) return res.status(400).json({ error: 'no_product' });
          if (p.stock < qty) return res.status(400).json({ error: 'out_of_stock' });
          conn.run('INSERT INTO cart_items(cart_id,product_id,qty,price_cents) VALUES (?,?,?,?)', [cartId, productId, qty, p.price_cents], function(err2) {
            if (err2) {
              log({ ts:new Date().toISOString(), service:'web', route:'/api/cart/add', level:'error', message:err2.message });
              return res.status(500).json({ error:'db' });
            }
            res.json({ ok:true });
          });
        });
      };
      if (cart && cart.id) {
        upsertCart(cart.id);
      } else {
        conn.run('INSERT INTO carts(user_id,created_at,updated_at) VALUES (?,?,datetime("now"))', [userId, new Date().toISOString()], function(errc){
          upsertCart(this.lastID);
        });
      }
    });
  });
  conn.close();
});

app.get('/api/cart', ensureAuth, (req,res) => {
  const userId = req.session.userId;
  const conn = db();
  conn.get('SELECT id FROM carts WHERE user_id = ? AND status="open"', [userId], (err, cart) => {
    if (!cart) return res.json({ items: [] });
    conn.all('SELECT ci.*, p.name, p.slug FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = ?', [cart.id], (err, rows) => {
      res.json({ items: rows });
    });
  });
});

app.post('/api/checkout', ensureAuth, async (req,res) => {
  const userId = req.session.userId;
  const conn = db();
  conn.get('SELECT id FROM carts WHERE user_id = ? AND status="open"', [userId], (err, cart) => {
    if (!cart) return res.status(400).json({ error: 'empty' });
    conn.all('SELECT ci.*, p.price_cents FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = ?', [cart.id], async (err, items) => {
      if (items.length === 0) return res.status(400).json({ error: 'empty' });
      const total = items.reduce((s,i)=>s + (i.qty * i.price_cents), 0);
      // call payment service
      try {
        const resp = await fetch('http://127.0.0.1:3001/pay', {
          method: 'POST',
          headers: {'content-type':'application/json'},
          body: JSON.stringify({ user: req.session.username || 'guest', total_cents: total, items })
        });
        const j = await resp.json();
        const now = new Date().toISOString();
        if (j.ok) {
          // create order and order items, decrement stock, close cart
          conn.serialize(() => {
            conn.run('INSERT INTO orders(user_id,total_cents,status,created_at) VALUES (?,?,?,?)', [userId, total, 'paid', now], function(erro){
              const orderId = this.lastID;
              const stmt = conn.prepare('INSERT INTO order_items(order_id,product_id,qty,price_cents) VALUES (?,?,?,?)');
              items.forEach(it => {
                stmt.run(orderId, it.product_id, it.qty, it.price_cents);
                conn.run('UPDATE products SET stock = stock - ? WHERE id = ?', [it.qty, it.product_id]);
              });
              stmt.finalize();
              conn.run('UPDATE carts SET status="closed", updated_at=? WHERE id=?', [now, cart.id]);
              // log
              log({ ts: new Date().toISOString(), level: 'info', service:'web', route:'/api/checkout', user: req.session.username, message:'Checkout completed', status:200, duration_ms: 0, details: { orderId }});
              res.json({ ok:true, orderId });
            });
          });
        } else {
          log({ ts: new Date().toISOString(), level:'error', service:'web', route:'/api/checkout', user: req.session.username, message:'Payment failed', status:502, details: j });
          res.status(502).json({ ok:false, error: 'payment_failed', details: j });
        }
      } catch (e) {
        log({ ts: new Date().toISOString(), level:'error', service:'web', route:'/api/checkout', message: e.message });
        res.status(500).json({ error: 'pay_error' });
      }
    });
  });
});

// vulnerable search endpoint (SQL Injection) — ENABLE_VULN must be true
app.get('/api/user/search', (req,res) => {
  const q = req.query.q || '';
  if (!ENABLE_VULN) return res.status(404).json({ error: 'not_found' });
  // intentionally insecure: string concatenation (for lab only)
  const sql = "SELECT id,username,email,role FROM users WHERE username LIKE '%" + q + "%' OR email LIKE '%" + q + "%' LIMIT 50";
  const conn = db();
  conn.all(sql, [], (err, rows) => {
    conn.close();
    if (err) return res.status(500).json({ error: 'db' });
    log({ ts: new Date().toISOString(), service:'web', route:'/api/user/search', user: req.session.username || 'anon', message:'vuln_search', details:{q, count: rows.length} });
    res.json(rows);
  });
});

// Admin endpoints
app.get('/admin/stats', ensureAuth, ensureAdmin, (req,res) => {
  const conn = db();
  conn.serialize(() => {
    conn.get('SELECT COUNT(*) as users FROM users', [], (e,u) => {
      conn.get('SELECT COUNT(*) as products FROM products', [], (e2,p) => {
        conn.get('SELECT COUNT(*) as orders FROM orders', [], (e3,o) => {
          res.json({ users: u.users, products: p.products, orders: o.orders });
        });
      });
    });
  });
});

let simProcess = null;
const SIM_FILE = path.join(__dirname, 'sim_state.json');
app.post('/admin/sim/start', ensureAuth, ensureAdmin, (req,res) => {
  const cfg = req.body;
  // write sim config to file; a simple simulator runs in background by node-cron or setInterval
  fs.writeFileSync(SIM_FILE, JSON.stringify({ running: true, cfg, started_at: new Date().toISOString() }, null, 2));
  // log start
  log({ ts: new Date().toISOString(), service:'sim', route:'/admin/sim/start', level:'info', message:'sim_start', details: cfg });
  // For demo, we just respond OK and the external simulator script (if any) can read sim_state
  res.json({ ok:true });
});

app.post('/admin/sim/stop', ensureAuth, ensureAdmin, (req,res) => {
  fs.writeFileSync(SIM_FILE, JSON.stringify({ running: false, stopped_at: new Date().toISOString() }, null, 2));
  log({ ts: new Date().toISOString(), service:'sim', route:'/admin/sim/stop', level:'info', message:'sim_stop' });
  res.json({ ok:true });
});

app.post('/admin/faults', ensureAuth, ensureAdmin, (req,res) => {
  const { errorRate, enabled } = req.body;
  const conn = db();
  conn.run('INSERT INTO faults(name,enabled,params_json) VALUES (?,?,?)', ['global_error_rate', enabled ? 1 : 0, JSON.stringify({ errorRate })], function(err) {
    if (err) return res.status(500).json({ error:'db' });
    res.json({ ok:true });
  });
});

app.post('/admin/rum', ensureAuth, ensureAdmin, (req,res) => {
  const { snippet } = req.body;
  // persist snippet to file for injection
  fs.writeFileSync(path.join(__dirname,'rum_snippet.txt'), snippet || '');
  res.json({ ok:true });
});

app.get('/admin/status', ensureAuth, ensureAdmin, (req,res) => {
  const state = fs.existsSync(SIM_FILE) ? JSON.parse(fs.readFileSync(SIM_FILE,'utf8')) : { running:false };
  res.json({ sim: state });
});

// mini-tail for logs (last N lines)
app.get('/admin/logs', ensureAuth, ensureAdmin, (req,res) => {
  const file = req.query.file || 'sim.log';
  const n = parseInt(req.query.n || '200', 10);
  const p = path.join('/var/log/lab-observability', file);
  if (!fs.existsSync(p)) return res.status(404).json({ error:'no_file' });
  const lines = fs.readFileSync(p,'utf8').split('\n').filter(Boolean);
  res.json(lines.slice(-n));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`lab web listening ${PORT}`);
  log({ ts: new Date().toISOString(), service: 'web', level: 'info', message: 'started', port: PORT, build: process.env.BUILD_SHA || 'dev' });
});
