#!/usr/bin/env bash
# Normaliza NAT 80->3000 (externo e local), garante INPUT/80 e persiste.
set -euo pipefail

# --- Remoção preventiva de regras antigas/duplicadas ---
# apaga qualquer REDIRECT envolvendo 80 (idempotente)
while iptables -t nat -C PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 3000 2>/dev/null; do
  iptables -t nat -D PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 3000 || true
done
while iptables -t nat -C OUTPUT -p tcp --dport 80 -m addrtype --dst-type LOCAL -j REDIRECT --to-ports 3000 2>/dev/null; do
  iptables -t nat -D OUTPUT -p tcp --dport 80 -m addrtype --dst-type LOCAL -j REDIRECT --to-ports 3000 || true
done
# limpa lixo de testes (ex.: 8080)
iptables -t nat -D PREROUTING -p tcp --dport 8080 -j REDIRECT --to-ports 3000 2>/dev/null || true
iptables -D INPUT -p tcp --dport 8080 -j ACCEPT 2>/dev/null || true

# --- Recria as regras canônicas ---
iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 3000
iptables -t nat -A OUTPUT -p tcp --dport 80 -m addrtype --dst-type LOCAL -j REDIRECT --to-ports 3000

# INPUT/80 e tráfego de retorno
iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 80 -j ACCEPT
iptables -C INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null || iptables -I INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# --- Persistência ---
if command -v netfilter-persistent >/dev/null 2>&1; then
  netfilter-persistent save || true
else
  mkdir -p /etc/iptables
  iptables-save > /etc/iptables/rules.v4
fi

echo "[iptables-persist] NAT 80→3000 normalizado e persistido"
