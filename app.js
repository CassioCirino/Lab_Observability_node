// app.js — SkillUp Web (Node)
const express = require('express');
const path = require('path');
const os = require('os');
const fetch = require('node-fetch'); // se não tiver, entra pelo npm install

const app = express();
const PORT = process.env.PORT || 80;
const PAY_PORT = process.env.PAY_PORT || 3001;
const PAY_URL = process.env.PAY_URL || `http://127.0.0.1:${PAY_PORT}`;

app.use(express.json());

// health para LB/monitoração
app.get('/health', (_req,res)=> res.json({ ok:true, app:'web', host: os.hostname() }) );

// catálogo "fake" (fixo, simples p/ DEM)
const PRODUCTS = [
  { id: 1, name: 'Camiseta SkillUp', price: 7990 },
  { id: 2, name: 'Mochila Observability', price: 18990 },
  { id: 3, name: 'Caneca DevOps', price: 4990 },
  { id: 4, name: 'Adesivo RUM', price: 990 },
];

app.get('/api/products', (_req,res)=> res.json(PRODUCTS));

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

// servir front-end estático
app.use('/public', express.static(path.join(__dirname, 'public')));
app.get('/', (_req,res)=> res.sendFile(path.join(__dirname, 'public', 'index.html')));

// start
app.listen(PORT, ()=>{
  console.log(`Web up on :${PORT}  (payments: ${PAY_URL})`);
});
