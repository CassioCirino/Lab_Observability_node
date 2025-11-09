// controllers/adminController.js
const express = require('express');
const router = express.Router();

const sim = require('../traffic/simulator');
const { scheduleInject, stopInject, faultState } = require('./faultController');

// Start traffic: body { baseRatePerMin: number, targets: [url], windows: [{start, end, ratePerMin}] }
router.post('/traffic/start', (req,res)=>{
  const { baseRatePerMin=10, targets=['http://127.0.0.1/'], windows=[] } = req.body || {};
  sim.setTargets(targets);
  sim.setBaseRate(parseInt(baseRatePerMin,10));
  // windows expected with ISO start/end strings and ratePerMin
  sim.setWindows(windows);
  sim.start();
  return res.json({ ok:true, baseRatePerMin, windows });
});

router.post('/traffic/stop', (_req,res)=>{
  sim.stop();
  return res.json({ ok:true });
});

router.get('/traffic/status', (_req,res)=>{
  return res.json({
    running: sim.running,
    baseRatePerMin: sim.currentRatePerMin,
    windows: sim.windows,
    targets: sim.targets
  });
});

// Faults control uses functions in faultController
router.post('/faults/start', (req,res)=>{
  // body: { totalErrors, durationHours, routes }
  const totalErrors = parseInt(req.body.totalErrors||0,10);
  const durationHours = parseFloat(req.body.durationHours||1);
  const routes = req.body.routes || ['/api/checkout'];
  const r = scheduleInject(totalErrors, durationHours*3600, routes);
  return res.json({ ok:true, schedule: r });
});

router.post('/faults/stop', (_req,res)=>{
  stopInject();
  return res.json({ ok:true });
});

router.get('/faults/status', (_req,res)=>{
  return res.json(faultState);
});

module.exports = router;
