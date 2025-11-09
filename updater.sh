#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/skillup-final-lab-node"
SERVICE="skillup-web.service"
BRANCH="main"
APP_USER="ubuntu"

say(){ echo -e "\033[1;36m[updater]\033[0m $*"; }

say "Parando serviço..."
sudo systemctl stop "$SERVICE" || true

say "Garantindo dono da pasta..."
sudo chown -R "$APP_USER:$APP_USER" "$REPO_DIR"

say "Atualizando código a partir do GitHub..."
sudo -u "$APP_USER" git -C "$REPO_DIR" fetch --all --prune
sudo -u "$APP_USER" git -C "$REPO_DIR" reset --hard "origin/$BRANCH"

say "Reinstalando dependências..."
sudo -u "$APP_USER" rm -rf "$REPO_DIR/node_modules"
sudo -u "$APP_USER" npm --prefix "$REPO_DIR" ci --no-audit --no-fund

say "Daemon-reload e start..."
sudo systemctl daemon-reload
sudo systemctl start "$SERVICE"

say "Aguardando subir..."
sleep 2

say "Health-check local:"
if curl -sf http://127.0.0.1/health >/dev/null ; then
  echo "OK"
else
  echo "ATENÇÃO: /health não respondeu (verifique logs)."
fi

say "Porta 80:"
sudo ss -lntp | grep ':80' || echo "Nada na :80"

say "Status do serviço:"
sudo systemctl status "$SERVICE" -n 40 --no-pager || true
