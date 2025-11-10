/**
 * db.js
 * - initialize sqlite DB
 * - run migrations (simple)
 * - seed realistic data
 *
 * Usage:
 *  node db.js --migrate
 *  node db.js --seed
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const DBDIR = path.resolve(__dirname, 'data');
const DBFILE = path.join(DBDIR, 'app.db');

function openDb() {
  if (!fs.existsSync(DBDIR)) fs.mkdirSync(DBDIR, { recursive: true });
  return new sqlite3.Database(DBFILE);
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = openDb();
    db.run(sql, params, function (err) {
      db.close();
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = openDb();
    db.all(sql, params, (err, rows) => {
      db.close();
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function migrate() {
  const sqls = fs.readFileSync(path.join(__dirname, 'migrations', '001_init.sql'), 'utf8');
  const db = openDb();
  await new Promise((res, rej) => {
    db.exec(sqls, (err) => {
      db.close();
      if (err) return rej(err);
      res();
    });
  });
  console.log('migrate: done');
}

async function seed() {
  const db = openDb();
  const saltRounds = 10;
  const adminPass = await bcrypt.hash('admin123', saltRounds);
  const users = [
    { username: 'admin', email: 'admin@lab.local', password_hash: adminPass, role: 'admin' }
  ];
  // add 10 plausible users
  for (let i = 1; i <= 10; i++) {
    const h = await bcrypt.hash('user' + i + 'pass', saltRounds);
    users.push({
      username: `user${i}`,
      email: `user${i}@example.com`,
      password_hash: h,
      role: 'user'
    });
  }

  await new Promise((resolve, reject) => {
    db.serialize(() => {
      const stmt = db.prepare(`INSERT OR IGNORE INTO users(username,email,password_hash,role,created_at,updated_at) VALUES (?,?,?,?,datetime('now'),datetime('now'))`);
      users.forEach(u => {
        stmt.run(u.username, u.email, u.password_hash, u.role);
      });
      stmt.finalize();
      resolve();
    });
  });

  // seed products (12)
  const products = [
    ["UltraPhone X1","ultraphone-x1","Smartphone topo de linha","https://picsum.photos/seed/phone1/600/400",79990,12,"Celulares"],
    ["EcoLaptop Pro","ecolaptop-pro","Notebook leve e potente","https://picsum.photos/seed/laptop1/600/400",499990,8,"Notebooks"],
    ["SmartWatch 3","smartwatch-3","Relógio inteligente com monitor de saúde","https://picsum.photos/seed/watch1/600/400",19990,20,"Wearables"],
    ["NoiseBuds Z","noisebuds-z","Fone sem fio cancelamento de ruído","https://picsum.photos/seed/earbuds1/600/400",9990,30,"Áudio"],
    ["Cam Action X","cam-action-x","Câmera esportiva 4K","https://picsum.photos/seed/cam1/600/400",15990,6,"Câmeras"],
    ["HomeSpeaker S","homespeaker-s","Caixa de som inteligente","https://picsum.photos/seed/speaker1/600/400",5990,25,"Áudio"],
    ["4K Monitor 27","4k-monitor-27","Monitor 27\" 4K HDR","https://picsum.photos/seed/monitor1/600/400",129990,5,"Monitores"],
    ["GamingMouse G5","gamingmouse-g5","Mouse gamer com DPI ajustável","https://picsum.photos/seed/mouse1/600/400",3990,40,"Periféricos"],
    ["Mechanical KB","mechanical-kb","Teclado mecânico RGB","https://picsum.photos/seed/keyboard1/600/400",5990,18,"Periféricos"],
    ["USB-C Hub 7in1","usbc-hub-7in1","Hub USB-C multiportas","https://picsum.photos/seed/hub1/600/400",2990,50,"Acessórios"],
    ["SmartLamp 2","smartlamp-2","Lâmpada inteligente com app","https://picsum.photos/seed/lamp1/600/400",1490,60,"Casa"],
    ["Drone Mini","drone-mini","Drone compacto com câmera","https://picsum.photos/seed/drone1/600/400",89990,7,"Drones"]
  ];

  await new Promise((resolve, reject) => {
    const stmt = db.prepare(`INSERT OR IGNORE INTO products(name,slug,description,image_url,price_cents,stock,category,created_at) VALUES (?,?,?,?,?,?,?,datetime('now'))`);
    products.forEach(p => {
      stmt.run(p[0], p[1], p[2], p[3], p[4], p[5], p[6]);
    });
    stmt.finalize();
    resolve();
  });

  // seed orders (5)
  await new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`INSERT OR IGNORE INTO orders(id, user_id, total_cents, status, created_at) SELECT 12345, (SELECT id FROM users WHERE username='user1' LIMIT 1), 19990, 'paid', datetime('now') WHERE NOT EXISTS(SELECT 1 FROM orders WHERE id=12345)`);
      resolve();
    });
  });

  db.close();
  console.log('seed: done');
}

async function main() {
  const arg = process.argv[2] || '';
  if (arg === '--migrate' || arg === 'migrate') {
    await migrate();
    process.exit(0);
  } else if (arg === '--seed' || arg === 'seed') {
    await seed();
    process.exit(0);
  } else {
    console.log('usage: node db.js --migrate | --seed');
    process.exit(0);
  }
}

if (require.main === module) main();

module.exports = { openDb, run, all };
