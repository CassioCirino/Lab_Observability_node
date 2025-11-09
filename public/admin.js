async function api(path, method='GET', body){
  const opts = { method, headers: {} };
  if(body){ opts.headers['Content-Type']='application/json'; opts.body=JSON.stringify(body); }
  const r = await fetch('/admin'+path, opts);
  return r.json();
}

document.getElementById('fe_start').onclick = async ()=>{
  const total = parseInt(document.getElementById('fe_total').value,10);
  const hours = parseFloat(document.getElementById('fe_hours').value);
  const routes = document.getElementById('fe_routes').value.split(',').map(s=>s.trim()).filter(Boolean);
  const res = await api('/faults/start','POST',{ totalErrors: total, durationHours: hours, routes });
  document.getElementById('fe_status').textContent = JSON.stringify(res, null, 2);
};

document.getElementById('fe_stop').onclick = async ()=> {
  const res = await api('/faults/stop','POST', {});
  document.getElementById('fe_status').textContent = JSON.stringify(res, null, 2);
};

document.getElementById('tr_start').onclick = async () => {
  const base = parseInt(document.getElementById('tr_base').value,10);
  const targets = document.getElementById('tr_targets').value.split(',').map(s=>s.trim()).filter(Boolean);
  let windows = [];
  try { windows = JSON.parse(document.getElementById('tr_windows').value || '[]'); } catch(e){ alert('JSON inválido em windows'); return; }
  const res = await api('/traffic/start','POST',{ baseRatePerMin: base, targets, windows });
  document.getElementById('tr_status').textContent = JSON.stringify(res, null, 2);
};

document.getElementById('tr_stop').onclick = async ()=> {
  const res = await api('/traffic/stop','POST', {});
  document.getElementById('tr_status').textContent = JSON.stringify(res, null, 2);
};
