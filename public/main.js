const fmt = v => (v/100).toFixed(2).replace('.', ',');

async function fetchProducts(){
  const r = await fetch('/api/products');
  if(!r.ok) throw new Error('Falha /api/products');
  return r.json();
}

function identify(user){
  try{
    // salva no localStorage e chama RUM (se existir)
    localStorage.setItem('skillup_user', user);
    window.dtrum && window.dtrum.identifyUser && window.dtrum.identifyUser(user);
  }catch(e){}
}

function loadUser(){
  const u = localStorage.getItem('skillup_user') || '';
  document.getElementById('username').value = u;
  if(u) identify(u);
}

function renderProducts(list){
  const wrap = document.getElementById('products');
  wrap.innerHTML = '';
  list.forEach(p=>{
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <strong>${p.name}</strong>
      <span>R$ ${fmt(p.price)}</span>
      <button data-id="${p.id}">Adicionar</button>
    `;
    wrap.appendChild(card);
  });
}

const cart = [];
function renderCart(){
  const ul = document.getElementById('cart');
  ul.innerHTML = '';
  let total = 0;
  cart.forEach(item=>{
    const li = document.createElement('li');
    li.textContent = `${item.name} — R$ ${fmt(item.price)}`;
    ul.appendChild(li);
    total += item.price;
  });
  document.getElementById('total').textContent = fmt(total);
}

async function main(){
  loadUser();

  const products = await fetchProducts();
  renderProducts(products);
  renderCart();

  document.getElementById('products').addEventListener('click', ev=>{
    const id = ev.target.dataset.id;
    if(!id) return;
    const p = products.find(x=> String(x.id)===String(id));
    if(p){ cart.push(p); renderCart(); }
  });

  document.getElementById('btnSaveUser').onclick = ()=>{
    const u = document.getElementById('username').value.trim();
    if(u){ identify(u); alert('User Tag aplicada: '+u); }
  };

  document.getElementById('checkout').onclick = async ()=>{
    const u = document.getElementById('username').value.trim() || 'Anon';
    const r = await fetch('/api/checkout', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ user:u, items: cart })
    });
    const msg = document.getElementById('msg');
    if(r.ok){
      const data = await r.json();
      msg.textContent = `Pedido #${data.orderId} autorizado ✔`;
      cart.length = 0; renderCart();
    }else{
      msg.textContent = 'Erro ao autorizar pagamento ✖';
    }
  };
}
main().catch(console.error);
