#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/lab-observability"

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root"
  exit 1
fi

cd "$REPO_DIR"
git fetch --all
git reset --hard origin/main
chown -R "$(whoami)":"$(whoami)" "$REPO_DIR"

cd "$REPO_DIR/lab-observability"
npm install --no-audit --no-fund
node db.js --migrate || true

systemctl restart lab-observability-web lab-observability-pay
mkdir -p /var/log/lab-observability
echo "$(date -u -Iseconds) updated" >> /var/log/lab-observability/updater.log
echo "updater: done"
