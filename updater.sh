#!/usr/bin/env bash
# Lab Observability Updater - puxa última versão e reaplica NAT/systemd
set -euo pipefail
LOGFILE="/var/log/lab-observability/updater.log"

echo "$(date -Iseconds) - Starting update..." | tee -a "$LOGFILE"

cd /opt/lab-observability || exit 1
git fetch --all >> "$LOGFILE" 2>&1
git reset --hard origin/main >> "$LOGFILE" 2>&1

echo "$(date -Iseconds) - Installing dependencies..." | tee -a "$LOGFILE"
cd lab-observability
npm install --no-audit --no-fund >> "$LOGFILE" 2>&1

echo "$(date -Iseconds) - Running migrations..." | tee -a "$LOGFILE"
node db.js --migrate >> "$LOGFILE" 2>&1 || true

echo "$(date -Iseconds) - Reapplying iptables rules..." | tee -a "$LOGFILE"
/bin/bash /opt/lab-observability/lab-observability/scripts/iptables-persist.sh >> "$LOGFILE" 2>&1

echo "$(date -Iseconds) - Restarting services..." | tee -a "$LOGFILE"
systemctl restart lab-observability-web lab-observability-pay >> "$LOGFILE" 2>&1

echo "$(date -Iseconds) - Update complete." | tee -a "$LOGFILE"
