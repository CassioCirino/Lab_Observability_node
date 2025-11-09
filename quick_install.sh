#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/CassioCirino/Lab_Observability_node.git"
DEST_DIR="/opt/skillup-final-lab-node"

log(){ echo -e "\033[1;32m[INFO]\033[0m $*"; }
need_root(){ [ "$(id -u)" -eq 0 ] || { echo "Execute com sudo/root"; exit 1; }; }

need_root
export DEBIAN_FRONTEND=noninteractive

# 1) deps básicos
if command -v apt-get >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y git curl ca-certificates
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y git curl ca-certificates
elif command -v yum >/dev/null 2>&1; then
  yum install -y git curl ca-certificates
fi

# 2) baixar/atualizar código
if [ -d "$DEST_DIR/.git" ]; then
  log "Atualizando código em $DEST_DIR"
  git -C "$DEST_DIR" pull --ff-only
else
  log "Clonando para $DEST_DIR"
  rm -rf "$DEST_DIR"
  git clone "$REPO_URL" "$DEST_DIR"
fi

# 3) rodar instalador do projeto
cd "$DEST_DIR"
chmod +x install_node.sh
log "Executando install_node.sh"
sudo bash ./install_node.sh

log "Pronto. Acesse:  http://<IP-PÚBLICO>/"
log "Opcional (gerar tráfego):  nohup node $DEST_DIR/traffic/simulator.js >/tmp/traffic.log 2>&1 &"
