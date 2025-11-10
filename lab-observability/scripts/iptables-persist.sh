#!/usr/bin/env bash
# idempotent: create NAT 80 -> 3000 for both external and local traffic, persist via netfilter-persistent
set -euo pipefail

# --- NAT PREROUTING (tráfego externo) ---
if ! iptables -t nat -C PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 3000 2>/dev/null; then
  iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 3000
fi

# --- NAT OUTPUT (tráfego local: 127.0.0.1 ou IPs locais) ---
if ! iptables -t nat -C OUTPUT -p tcp -m addrtype --dst-type LOCAL --dport 80 -j REDIRECT --to-ports 3000 2>/dev/null; then
  iptables -t nat -A OUTPUT -p tcp -m addrtype --dst-type LOCAL --dport 80 -j REDIRECT --to-ports 3000
fi

# --- IPv6 equivalente (opcional, cobre ::1/localhost) ---
if command -v ip6tables >/dev/null 2>&1; then
  if ! ip6tables -t nat -C PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 3000 2>/dev/null; then
    ip6tables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-ports 3000
  fi
  if ! ip6tables -t nat -C OUTPUT -p tcp -m addrtype --dst-type LOCAL --dport 80 -j REDIRECT --to-ports 3000 2>/dev/null; then
    ip6tables -t nat -A OUTPUT -p tcp -m addrtype --dst-type LOCAL --dport 80 -j REDIRECT --to-ports 3000
  fi
fi

# --- Permitir tráfego loopback (opcional) ---
if ! iptables -C INPUT -i lo -j ACCEPT 2>/dev/null; then
  iptables -A INPUT -i lo -j ACCEPT
fi

# --- Persistência das regras ---
if command -v netfilter-persistent >/dev/null 2>&1; then
  run-parts --report /usr/share/netfilter-persistent/plugins.d || true
  netfilter-persistent save || true
else
  mkdir -p /etc/iptables
  iptables-save > /etc/iptables/rules.v4
  if command -v ip6tables >/dev/null 2>&1; then
    ip6tables-save > /etc/iptables/rules.v6
  fi
fi

echo "[iptables-persist] NAT 80→3000 (ext + local) aplicado e persistido"
