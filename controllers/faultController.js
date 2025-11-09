// controllers/faultController.js
// Middleware + scheduler para injetar erros 500 em rotas configuradas.

const express = require('express');
const router = express.Router();

const faultState = {
  active: false,
  queue: [], // tokens (each token = 1 error to cause)
  routes: ['/api/checkout'], // rotas alvo
  startedAt: null,
  endsAt: null,
  totalRequested: 0,
  generated: 0,
  timerHandles: []
};

function middlewareFailInjector(req, res, next) {
  try {
    // Only consider configured routes (simple match)
    if (faultState.active && faultState.routes.some(r => req.path.startsWith(r))) {
      if (faultState.queue.length > 0) {
        faultState.queue.shift(); // consume token
        faultState.generated = (faultState.generated || 0) + 1;
        // Respond with 500 and a helpful body for tracing
        return res.status(500).json({ error: 'Injected fault', source: 'fault-injector' });
      }
    }
  } catch (e) {
    // ignore and continue
    console.error('fault injector middleware error', e);
  }
  next();
}

// schedule generation of N tokens spread randomly across durationSeconds
function scheduleInject(totalErrors, durationSeconds, routes = ['/api/checkout']) {
  // clean previous timers
  faultState.timerHandles.forEach(h => clearTimeout(h));
  faultState.timerHandles = [];

  const now = Date.now();
  const endAt = now + durationSeconds * 1000;
  faultState.active = true;
  faultState.routes = routes;
  faultState.startedAt = new Date(now).toISOString();
  faultState.endsAt = new Date(endAt).toISOString();
  faultState.totalRequested = totalErrors;
  faultState.generated = 0;
  faultState.queue = [];

  // generate N random timestamps in [now, endAt)
  const times = [];
  for (let i = 0; i < totalErrors; i++) {
    const t = now + Math.floor(Math.random() * (durationSeconds * 1000));
    times.push(t);
  }
  times.sort((a,b)=>a-b);

  // For each timestamp, schedule a timer to push a token into queue at that time.
  times.forEach(ts => {
    const delay = Math.max(0, ts - Date.now());
    const h = setTimeout(()=> {
      faultState.queue.push({ createdAt: Date.now() });
    }, delay);
    faultState.timerHandles.push(h);
  });

  // schedule end (safety)
  const endHandle = setTimeout(()=> {
    // deactivate but keep any leftover tokens for a short time
    faultState.active = false;
  }, durationSeconds*1000 + 60*1000);
  faultState.timerHandles.push(endHandle);

  return {
    startedAt: faultState.startedAt,
    endsAt: faultState.endsAt,
    scheduled: times.length
  };
}

function stopInject() {
  faultState.timerHandles.forEach(h => clearTimeout(h));
  faultState.timerHandles = [];
  faultState.active = false;
  faultState.queue = [];
  faultState.generated = 0;
  faultState.totalRequested = 0;
  faultState.startedAt = null;
  faultState.endsAt = null;
}

router.post('/start', (req,res) => {
  // body: { totalErrors: number, durationHours: number, routes: ["/api/..."] }
  const { totalErrors=10, durationHours=1, routes } = req.body || {};
  const durSec = Math.max(1, parseFloat(durationHours) * 3600);
  const r = scheduleInject(parseInt(totalErrors,10), durSec, Array.isArray(routes) && routes.length ? routes : faultState.routes );
  return res.json({ ok:true, schedule: r });
});

router.post('/stop', (_req,res) => {
  stopInject();
  return res.json({ ok:true });
});

router.get('/status', (_req,res) => {
  return res.json({
    active: !!faultState.active,
    totalRequested: faultState.totalRequested,
    queued: faultState.queue.length,
    generated: faultState.generated,
    routes: faultState.routes,
    startedAt: faultState.startedAt,
    endsAt: faultState.endsAt
  });
});

module.exports = { router, middlewareFailInjector, faultState, scheduleInject, stopInject };
