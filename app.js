// app.js — SkillUp Web (Node) — versão com Admin + Fault Injector + fallback de front
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const fetch = require('node-fetch'); // npm i node-fetch@2

// --- novas importações (admin + fault) ---
const { middlewareFailInjector } = require('./controllers/faultController');
const adminRouter = require('./controllers/adminController');

const app = express();
const PORT = process.env.PORT || 80;
const PAY_PORT = process.env.PAY_PORT || 3001;
const PAY_URL = process.env.PAY_URL || `http://127.0.0.1:${PAY_PORT}`;

app.use(express.json());

// health para LB/monitoração
app.get('/health', (_req,res)=> res.json({ ok:true, app:'web', host: os.hostname(), pay: PAY_URL }) );

// catálogo "fake" (fixo, simples p/ DEM)
const PRODUCTS = [
  { id: 1, name: 'Camiseta SkillUp', price: 7990 },
  { id: 2, name: 'Mochila Observability', price: 18990 },
  { id: 3, name: 'Caneca DevOps', price: 4990 },
  { id: 4, name: 'Adesivo RUM', price: 990 },
];

app.get('/api/products', (_req,res)=> res.json(PRODUCTS));

// --- middleware de injeção de erro (antes das rotas alvo) ---
app.use(middlewareFailInjector);

// checkout → chama payment-service
app.post('/api/checkout', async (req,res)=>{
  try{
    const { user='Anon', items=[] } = req.body || {};
    const total = items.reduce((a,b)=> a + (b.price||0), 0);
    const payload = { user, total, items };

    const r = await fetch(`${PAY_URL}/pay`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload),
      timeout: 8000
    });

    if(!r.ok){
      const txt = await r.text();
      return res.status(502).json({ ok:false, error:'payment_failed', detail:txt });
    }
    const data = await r.json();
    return res.json({ ok:true, orderId: data.orderId || Date.now(), auth:data });
  }catch(err){
    console.error('checkout error', err);
    return res.status(500).json({ ok:false, error:'internal' });
  }
});

// --- Admin API (trafego + faults) ---
app.use('/admin', adminRouter);

// servir arquivos estáticos do front e da admin
app.use('/public', express.static(path.join(__dirname, 'public')));

// /admin.html (UI de controle)
app.get('/admin.html', (_req,res)=>{
  const p = path.join(__dirname, 'public', 'admin.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  return res.status(404).send('<h1>Admin UI não encontrada</h1><p>Faltou public/admin.html</p>');
});

// página inicial (fallback se index.html não existir)
app.get('/', (_req,res)=>{
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  // fallback bem simples para não ficar branco caso o arquivo não esteja no repo
  return res
    .status(200)
    .send(`<!doctype html>
<html><head><meta charset="utf-8"><title>SkillUp Store</title></head>
<body style="font-family:system-ui;margin:40px">
  <h1>SkillUp Store</h1>
  <p>Front não encontrado em <code>/public/index.html</code>.</p>
  <p>Admin: <a href="/admin.html">/admin.html</a></p>
  <pre>/api/products, /api/checkout</pre>
</body></html>`);
});

// start
app.listen(PORT, ()=>{
  console.log(`Web up on :${PORT}  (payments: ${PAY_URL})`);
});
