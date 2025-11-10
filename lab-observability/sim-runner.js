// sim-runner.js (OPTIONAL)
// read sim_state.json and perform simulated page hits - writes to sim.log
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const LOG = '/var/log/lab-observability/sim.log';

function log(o){ fs.appendFileSync(LOG, JSON.stringify(o) + '\n'); }

async function tick(cfg){
  const rpm = cfg.baseRPM || 1;
  const actions = Math.max(1, Math.round(rpm / 60));
  for (let i=0;i<actions;i++){
    // simulate simple flow
    try {
      await fetch('http://127.0.0.1:3000/');
      await fetch('http://127.0.0.1:3000/api/products');
      log({ ts: new Date().toISOString(), service:'sim', level:'info', message:'bot_action' });
    } catch(e){
      log({ ts: new Date().toISOString(), service:'sim', level:'error', message: e.message });
    }
  }
}

async function run(){
  const stateFile = path.join(__dirname,'sim_state.json');
  setInterval(async () => {
    if (!fs.existsSync(stateFile)) return;
    const s = JSON.parse(fs.readFileSync(stateFile,'utf8'));
    if (s && s.running && s.cfg) {
      await tick(s.cfg);
    }
  }, 1000*10);
}

run();
