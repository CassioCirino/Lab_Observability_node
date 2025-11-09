#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/skillup-final-lab-node"
PORT_WEB="${PORT_WEB:-80}"
PORT_PAY="${PORT_PAY:-3001}"

need_root(){ [ "$(id -u)" -eq 0 ] || { echo "use sudo"; exit 1; }; }
log(){ echo -e "\033[1;32m[INFO]\033[0m $*"; }

need_root

# 1) dependências
if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y curl git ca-certificates iptables-persistent || true
  # Node 20.x
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y curl git ca-certificates
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  dnf install -y nodejs
elif command -v yum >/dev/null 2>&1; then
  yum install -y curl git ca-certificates
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  yum install -y nodejs
else
  echo "sem gerenciador compatível"; exit 1
fi

# 2) instalar deps Node
cd "${APP_DIR}"
npm ci || npm install

# 3) systemd (web)
cat >/etc/systemd/system/skillup-web.service <<EOF
[Unit]
Description=SkillUp Web (Node)
After=network.target

[Service]
WorkingDirectory=${APP_DIR}
Environment=PORT=${PORT_WEB}
ExecStart=/usr/bin/node ${APP_DIR}/app.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 4) systemd (payment)
cat >/etc/systemd/system/skillup-pay.service <<EOF
[Unit]
Description=SkillUp Payment Service (Node)
After=network.target

[Service]
WorkingDirectory=${APP_DIR}
Environment=PORT=${PORT_PAY}
ExecStart=/usr/bin/node ${APP_DIR}/payment-service.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# 5) firewall/iptables (libera 80)
if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
  firewall-cmd --add-service=http --permanent || true
  firewall-cmd --reload || true
else
  if ! iptables -C INPUT -p tcp --dport "${PORT_WEB}" -j ACCEPT 2>/dev/null; then
    iptables -I INPUT -p tcp --dport "${PORT_WEB}" -j ACCEPT || true
  end
  if command -v netfilter-persistent >/dev/null 2>&1; then
    netfilter-persistent save || true
  fi
fi

# 6) start
systemctl daemon-reload
systemctl enable --now skillup-pay.service
systemctl enable --now skillup-web.service

log "OK. Services:"
systemctl --no-pager --full status skillup-pay.service | sed -n '1,8p' || true
systemctl --no-pager --full status skillup-web.service | sed -n '1,8p' || true

log "Healthchecks:"
curl -s http://127.0.0.1:${PORT_PAY}/health || true
echo
curl -s http://127.0.0.1:${PORT_WEB}/health || true
echo

log "Gerador de tráfego (opcional):  nohup node ${APP_DIR}/traffic/simulator.js >/tmp/traffic.log 2>&1 &"
log "Acesse: http://SEU-IP-PUBLICO/"
