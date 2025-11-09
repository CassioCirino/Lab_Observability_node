// traffic/simulator.js
// Simple traffic generator that calls URLs at a configurable rate (users/min).
// Config and schedule via HTTP API (admin will control).

const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

class TrafficSimulator {
  constructor() {
    this.running = false;
    this.currentRatePerMin = 0;
    this.targets = ['http://127.0.0.1/']; // default targets
    this.handle = null;
    this.windows = []; // array of { startISO, endISO, ratePerMin }
  }

  setTargets(list) { this.targets = list; }
  setBaseRate(rpm) { this.currentRatePerMin = rpm; }
  setWindows(w) { this.windows = w || []; }

  start() {
    if (this.running) return;
    this.running = true;
    this._tickLoop();
  }

  stop() {
    this.running = false;
    if (this.handle) { clearTimeout(this.handle); this.handle = null; }
  }

  _currentRate() {
    const now = new Date();
    for (const w of this.windows) {
      const s = new Date(w.start);
      const e = new Date(w.end);
      if (now >= s && now <= e) return w.ratePerMin;
    }
    return this.currentRatePerMin;
  }

  async _fireOne() {
    // pick random target
    const target = this.targets[Math.floor(Math.random() * this.targets.length)];
    const sessionId = uuidv4();
    // add headers to simulate real user/session
    try {
      await fetch(target, {
        method: 'GET',
        headers: {
          'X-SkillUp-Session': sessionId,
          'User-Agent': 'skillup-sim/1.0',
          'Accept': 'text/html,application/json'
        },
        timeout: 5000
      });
    } catch (e) {
      // ignore errors, still counts as traffic for load test
    }
  }

  _tickLoop() {
    if (!this.running) return;
    const rpm = Math.max(0, this._currentRate());
    if (rpm === 0) {
      // idle check every 5s
      this.handle = setTimeout(()=> this._tickLoop(), 5000);
      return;
    }
    // compute interval between requests in ms given rpm (requests per minute)
    const intervalMs = Math.max(10, Math.floor(60000 / rpm));
    // fire one request
    this._fireOne();
    // schedule next
    this.handle = setTimeout(()=> this._tickLoop(), intervalMs);
  }
}

module.exports = new TrafficSimulator();
