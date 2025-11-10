// minimal client helper to call APIs
async function api(path, opts={}) {
  const res = await fetch(path, opts);
  if (res.headers.get('content-type')?.includes('application/json')) return res.json();
  return res.text();
}
