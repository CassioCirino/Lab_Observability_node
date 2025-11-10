#!/usr/bin/env bash
set -euo pipefail

# install.sh — Lab Observability (Node)
# Assumptions: run as root (quickinstall usa sudo)

REPO_URL="https://github.com/CassioCirino/Lab_Observability_node.git"
REPO_DIR="/opt/lab-observability"
APP_DIR="$REPO_DIR/lab-observability"
LOG_DIR="/var/log/lab-observability"
SYSTEMD_DIR="/etc/systemd/system"

echo "[install] starting"

if [ "$(id -u)" -ne 0 ]; then
  echo "[install] must be run as root; re-run with sudo"
  exit 1
fi

# 1) System packages
echo "[install] apt update && install base"
apt-get update -y
apt-get install -y curl git build-essential gnupg2 ca-certificates lsb-release \
                   net-tools iproute2 iptables iptables-persistent

# 1.a) Node 20 LTS (Nodesource) se ausente/antigo
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  echo "[install] installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# 2) Clone/Update repo
if [ ! -d "$REPO_DIR/.git" ]; then
  echo "[install] cloning repo into $REPO_DIR"
  rm -rf "$REPO_DIR" || true
  git clone "$REPO_URL" "$REPO_DIR"
else
  echo "[install] fetching latest"
  (cd "$REPO_DIR" && git fetch --all && git reset --hard origin/main)
fi

# 3) App deps
echo "[install] npm install --no-audit --no-fund"
cd "$APP_DIR"
npm install --no-audit --no-fund

# 4) DB migrate + seed (idempotente)
echo "[install] migrating DB"
node db.js --migrate || true
echo "[install] seeding DB"
node db.js --seed || true

# 5) Diretórios de log e dados
mkdir -p "$LOG_DIR"
chmod 755 "$LOG_DIR"
chown -R root:root "$LOG_DIR"
mkdir -p "$APP_DIR/data" || true

# 6) Systemd units (web & pay)
echo "[install] installing systemd units"
install -m 0644 "$APP_DIR/systemd/lab-observability-web.service" "$SYSTEMD_DIR/lab-observability-web.service"
install -m 0644 "$APP_DIR/systemd/lab-observability-pay.service" "$SYSTEMD_DIR/lab-observability-pay.service"

# 7) Serviço one-shot para normalizar NAT no boot
# (evita duplicatas e garante ordem correta das regras)
if [ -f "$APP_DIR/systemd/lab-observability-netfix.service" ]; then
  install -m 0644 "$APP_DIR/systemd/lab-observability-netfix.service" \
    "$SYSTEMD_DIR/lab-observability-netfix.service"
fi

systemctl daemon-reload

# 8) NAT 80 -> 3000 + INPUT/80 (normalizado e persistente)
echo "[install] applying iptables NAT and INPUT rules"
bash "$APP_DIR/scripts/iptables-persist.sh"

# 9) UFW (se existir e estiver ativo) — não conflita com iptables
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  echo "[install] ufw allow 80/tcp"
  ufw allow 80/tcp || true
else
  echo "[install] ensuring iptables INPUT 80 when UFW inactive"
  iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 80 -j ACCEPT
  iptables -C INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || iptables -I INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
  netfilter-persistent save || true
fi

# 10) Enable services (web, pay, netfix)
echo "[install] enabling systemd services"
systemctl enable --now lab-observability-web.service
systemctl enable --now lab-observability-pay.service
systemctl enable --now lab-observability-netfix.service 2>/dev/null || true

# 11) Permissões finais (não falha se /data não existir ainda)
chown -R root:root "$REPO_DIR" || true
chown -R root:root "$APP_DIR/data" || true

# 12) Smoke-tests
echo "[install] smoke tests:"
set +e
curl -I --retry 3 --retry-delay 2 --max-time 5 http://127.0.0.1/ || true
set -e

echo "[install] done"
