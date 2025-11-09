const express = require('express');
const body = require('body-parser');
const cookie = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');

const auth = require('./controllers/authController');
const product = require('./controllers/productController');
const order = require('./controllers/orderController');
const faults = require('./controllers/faultController');

// tenta carregar SDK (se OneAgent disponibilizar – opcional e tolerante)
try { require('dynatrace-oneagent-sdk'); } catch {}

const app = express();
app.use(morgan('combined'));
app.use(body.json());
app.use(cookie());

// páginas simples (HTML mínimo)
app.get('/', (_req, res) => {
  res.type('html').send(`
    <h1>SkillUp Store</h1>
    <p><a href="/products">/products</a> | <a href="/admin/toggles">/admin/toggles</a></p>
    <p>Use POST /login {"email":"seu@lab"} • POST /checkout {"items":[{"price":10},{"price":20}]}</p>
  `);
});

app.get('/products', product.list);
app.post('/seed', product.seed);

app.post('/login', auth.login);
app.post('/logout', auth.logout);

app.post('/checkout', order.checkout);

// toggles de falha
app.get('/admin/toggles', faults.get);
app.post('/admin/toggles', faults.update);

// health
app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 80;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`web-app listening on ${PORT}`);
});
