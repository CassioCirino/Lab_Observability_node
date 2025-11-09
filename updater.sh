#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/CassioCirino/Lab_Observability_node.git"
APP_DIR="/opt/skillup-final-lab-node"

log(){ echo -e "\033[1;32m[UPDATER]\033[0m $*"; }
need_root(){ [ "$(id -u)" -eq 0 ] || { echo "Execute com sudo/root"; exit 1; }; }

need_root
export DEBIAN_FRONTEND=noninteractive

# deps mínimos
if command -v apt-get >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y git curl ca-certificates
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y git curl ca-certificates
elif command -v yum >/dev/null 2>&1; then
  yum install -y git curl ca-certificates
fi

# garantir diretório e clone/update
if [ ! -d "$APP_DIR" ]; then
  mkdir -p "$APP_DIR"
fi

if [ -d "$APP_DIR/.git" ]; then
  log "Atualizando código em $APP_DIR (git pull)..."
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" reset --hard origin/main
else
  log "Clonando $REPO_URL para $APP_DIR ..."
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

# reinstalar deps só se necessário (mudança em package-lock ou package.json)
cd "$APP_DIR"
if [ -f package-lock.json ]; then
  log "Executando npm ci ..."
  npm ci --no-audit --no-fund
else
  log "Executando npm install ..."
  npm install --no-audit --no-fund
fi

# reiniciar serviços
log "Reiniciando serviços..."
systemctl daemon-reload
systemctl restart skillup-pay.service || true
systemctl restart skillup-web.service || true

log "Status breve:"
systemctl --no-pager --full status skillup-web.service | sed -n '1,10p' || true
systemctl --no-pager --full status skillup-pay.service | sed -n '1,10p' || true

log "OK. Atualizado."
