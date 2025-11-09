const axios = require('axios');

const BASE = process.env.BASE || 'http://127.0.0.1';
const user = 'aluno+' + Math.floor(Math.random() * 1e6) + '@lab';

async function run() {
  try {
    await axios.post(`${BASE}/seed`).catch(()=>{});
    await axios.get(`${BASE}/products`);
    await axios.post(`${BASE}/login`, { email: user });
    await axios.post(`${BASE}/checkout`, { items: [{ price: 10 }, { price: 20 }, { price: 5 }] });
  } catch (e) {
    // ignora
  }
}

setInterval(run, 2000);
run();
