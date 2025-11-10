#!/usr/bin/env bash
set -euo pipefail

# install.sh - assumptions: run as root (quickinstall uses sudo for this)
REPO_DIR="/opt/lab-observability"
NODE_VERSION="20"
LOG_DIR="/var/log/lab-observability"

echo "[install] starting"

if [ "$(id -u)" -ne 0 ]; then
  echo "[install] must be run as root; re-run with sudo"
  exit 1
fi

# 1) system packages
echo "[install] apt update && apt install -y curl git build-essential"
apt-get update -y
apt-get install -y curl git build-essential gnupg2 ca-certificates lsb-release

# 1.a) install Node 20 (Nodesource)
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  echo "[install] installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# 2) clone/update repo
if [ ! -d "$REPO_DIR" ]; then
  git clone https://github.com/CassioCirino/Lab_Observability_node.git "$REPO_DIR"
else
  cd "$REPO_DIR"
  git fetch --all
  git reset --hard origin/main || true
fi

cd "$REPO_DIR/lab-observability"

# 3) npm install
echo "[install] npm install --no-audit --no-fund"
npm install --no-audit --no-fund

# 4) DB migrate + seed
echo "[install] migrating DB"
node db.js --migrate || true
echo "[install] seeding DB"
node db.js --seed || true

# 5) create log dir
mkdir -p "$LOG_DIR"
chown -R "$(whoami)":"$(whoami)" "$LOG_DIR"
chmod 755 "$LOG_DIR"

# 6) create systemd unit files
SYSTEMD_DIR="/etc/systemd/system"
cp -f "$REPO_DIR/lab-observability/systemd/lab-observability-web.service" "$SYSTEMD_DIR/"
cp -f "$REPO_DIR/lab-observability/systemd/lab-observability-pay.service" "$SYSTEMD_DIR/"
systemctl daemon-reload

# 7) iptables NAT 80 -> 3000 (idempotent)
# Use iptables-restore with persisted file
IPTABLES_SCRIPT="$REPO_DIR/lab-observability/scripts/iptables-persist.sh"
bash "$IPTABLES_SCRIPT"

# ensure ufw allows 80 if present
if command -v ufw >/dev/null 2>&1; then
  ufw allow 80/tcp || true
fi

# 8) enable services
echo "[install] enabling systemd services"
systemctl enable --now lab-observability-web.service || true
systemctl enable --now lab-observability-pay.service || true

# 9) final perms
chown -R "$(whoami)":"$(whoami)" "$REPO_DIR"
chown -R "$(whoami)":"$(whoami)" /opt/lab-observability/data || true

echo "[install] smoke tests:"
curl -I --retry 3 --retry-delay 2 --max-time 5 http://127.0.0.1/ || true

echo "[install] done"
