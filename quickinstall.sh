#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/CassioCirino/Lab_Observability_node.git"
DEST="/opt/lab-observability"
BRANCH="main"

echo "[quickinstall] starting"
if [ ! -d "$DEST" ]; then
  echo "[quickinstall] cloning repo to $DEST"
  sudo git clone --depth=1 --branch "$BRANCH" "$REPO" "$DEST"
else
  echo "[quickinstall] repo exists, fetching latest"
  cd "$DEST"
  sudo git fetch --all
  sudo git reset --hard "origin/$BRANCH"
fi

echo "[quickinstall] setting perms"
sudo chown -R "$(whoami)":"$(whoami)" "$DEST"

echo "[quickinstall] running install.sh"
sudo bash -lc "$DEST/install.sh"

echo "[quickinstall] smoke tests:"
echo " - local: curl -I http://127.0.0.1/"
echo " - public: curl -I http://<PUBLIC_IP>/"
echo ""
echo "Access the app at: http://<PUBLIC_IP>/"
echo "[quickinstall] done"
