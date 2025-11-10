#!/usr/bin/env bash
# idempotent: create NAT rule 80 -> 3000 and persist via /etc/iptables/rules.v4
set -euo pipefail

# ensure iptables nat PREROUTING
if ! iptables -t nat -C PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 3000 2>/dev/null; then
  iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 3000
fi

# ensure forwarding rule
if ! iptables -C FORWARD -p tcp -d 127.0.0.1/32 --dport 3000 -j ACCEPT 2>/dev/null; then
  iptables -A FORWARD -p tcp -d 127.0.0.1/32 --dport 3000 -j ACCEPT || true
fi

# persist iptables (try iptables-persistent if installed)
if command -v netfilter-persistent >/dev/null 2>&1; then
  netfilter-persistent save || true
else
  # write to /etc/iptables/rules.v4
  mkdir -p /etc/iptables
  iptables-save > /etc/iptables/rules.v4
fi

echo "[iptables-persist] rules applied"
