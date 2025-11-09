#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/skillup-final-lab-node"
PORT_WEB="${PORT_WEB:-80}"
PORT_PAY="${PORT_PAY:-3001}"

log(){ echo -e "\033[1;32m[INFO]\033[0m $*"; }
need_root(){ [ "$(id -u)" -eq 0 ] || { echo "Execute com sudo/root"; exit 1; }; }
need_root

# 1) Dependências + Node 20
if command -v apt-get >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y curl git ca-certificates iptables-persistent || true
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
  echo "Distribuição não suportada."; exit 1
fi

# 2) Instalar pacotes Node
cd "${APP_DIR}"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

# 3) Units systemd
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

# 4) Abrir porta 80 na VM (mesma correção que funcionou antes)
#    - se firewalld: usa firewall-cmd
#    - se UFW ativo: libera http
#    - caso contrário: regra iptables + persistência (se existir)
if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
  firewall-cmd --add-service=http --permanent || true
  firewall-cmd --reload || true
elif command -v ufw >/dev/null 2>&1 && ufw status | grep -qi "Status: active"; then
  ufw allow 80/tcp || true
else
  if ! iptables -C INPUT -p tcp --dport "${PORT_WEB}" -j ACCEPT 2>/dev/null; then
    iptables -I INPUT -p tcp --dport "${PORT_WEB}" -j ACCEPT || true
  fi
  if command -v netfilter-persistent >/dev/null 2>&1; then
    netfilter-persistent save || true
  elif command -v service >/dev/null 2>&1 && [ -x /usr/sbin/iptables-save ]; then
    /usr/sbin/iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
  fi
fi

# 5) Startar serviços
systemctl daemon-reload
systemctl enable --now skillup-pay.service
systemctl enable --now skillup-web.service

log "Status:"
systemctl --no-pager --full status skillup-pay.service | sed -n '1,10p' || true
systemctl --no-pager --full status skillup-web.service | sed -n '1,10p' || true

log "Healthchecks:"
curl -s http://127.0.0.1:${PORT_PAY}/health || true; echo
curl -s http://127.0.0.1:${PORT_WEB}/health || true; echo

log "Tráfego opcional:"
echo "nohup node ${APP_DIR}/traffic/simulator.js >/tmp/traffic.log 2>&1 &"
