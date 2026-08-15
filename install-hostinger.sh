#!/usr/bin/env sh
set -eu

COMPOSE_FILE="docker-compose.hostinger.yml"

say() { printf '\n%s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
ask() {
  prompt="$1"; default="${2:-}"
  if [ -n "$default" ]; then printf '%s [%s]: ' "$prompt" "$default" > /dev/tty; else printf '%s: ' "$prompt" > /dev/tty; fi
  IFS= read -r answer < /dev/tty || true
  printf '%s' "${answer:-$default}"
}

[ "$(uname -s)" = Linux ] || fail "Run this on the Hostinger VPS, not your local computer."
command -v docker >/dev/null 2>&1 || fail "Docker is missing. In hPanel select VPS > OS & Panel > Docker template."
docker compose version >/dev/null 2>&1 || fail "The Docker Compose plugin is missing. Reinstall the Hostinger Docker template."
command -v openssl >/dev/null 2>&1 || fail "OpenSSL is required (apt-get install openssl)."
[ -f "$COMPOSE_FILE" ] || fail "$COMPOSE_FILE was not found. Run this from the Traefik Pilot repository."

if [ -f .env ]; then
  say "Existing .env detected; keeping its secrets."
  DOMAIN=$(sed -n 's/^PILOT_DOMAIN=//p' .env | head -n1)
  [ -n "$DOMAIN" ] || fail "Existing .env is missing PILOT_DOMAIN. Add it or replace .env."
else
  DOMAIN=${PILOT_DOMAIN:-$(ask "Admin domain" "traefik-admin.example.com")}
  EMAIL=${ACME_EMAIL:-$(ask "Let's Encrypt email" "admin@example.com")}
  case "$DOMAIN" in *.*) ;; *) fail "Enter a full domain such as traefik-admin.example.com.";; esac
  case "$EMAIL" in *@*.*) ;; *) fail "Enter a valid email address.";; esac
  DB_PASSWORD=$(openssl rand -hex 24)
  JWT_SECRET=$(openssl rand -hex 48)
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  umask 077
  {
    printf 'PILOT_DOMAIN=%s\n' "$DOMAIN"
    printf 'ACME_EMAIL=%s\n' "$EMAIL"
    printf 'POSTGRES_DB=traefik_pilot\nPOSTGRES_USER=pilot\n'
    printf 'POSTGRES_PASSWORD=%s\n' "$DB_PASSWORD"
    printf 'DATABASE_URL=postgres://pilot:%s@db:5432/traefik_pilot\n' "$DB_PASSWORD"
    printf 'JWT_SECRET=%s\nENCRYPTION_KEY=%s\n' "$JWT_SECRET" "$ENCRYPTION_KEY"
    printf 'ADMIN_ORIGIN=https://%s\n' "$DOMAIN"
    printf 'TRAEFIK_LOG_LEVEL=INFO\nLOG_LEVEL=info\nDEMO_MODE=false\nTZ=UTC\n'
  } > .env
  say "Generated .env with mode 600 and strong random secrets."
fi

PUBLIC_IP=""
if command -v curl >/dev/null 2>&1; then PUBLIC_IP=$(curl -4fsS --max-time 5 https://api.ipify.org 2>/dev/null || true); fi
DNS_IP=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}' || true)
if [ -n "$PUBLIC_IP" ] && [ "$DNS_IP" != "$PUBLIC_IP" ]; then
  say "DNS CHECK: $DOMAIN resolves to ${DNS_IP:-nothing}; this VPS is $PUBLIC_IP."
  say "Create or update the A record in Hostinger hPanel before expecting HTTPS to become ready."
fi

say "Validating the Hostinger Compose project..."
docker compose -f "$COMPOSE_FILE" config --quiet

say "Building and starting Traefik Pilot..."
docker compose -f "$COMPOSE_FILE" up -d --build

mkdir -p "$HOME/.local/bin"
cp scripts/pilot.sh "$HOME/.local/bin/pilot"
chmod 700 "$HOME/.local/bin/pilot"
mkdir -p "$HOME/.config/traefik-pilot"
pwd > "$HOME/.config/traefik-pilot/root"
chmod 600 "$HOME/.config/traefik-pilot/root"

say "Waiting for services..."
attempt=0
until docker compose -f "$COMPOSE_FILE" ps --status running 2>/dev/null | grep -q 'traefik-pilot-web'; do
  attempt=$((attempt+1)); [ "$attempt" -ge 30 ] && break; sleep 2
done

docker compose -f "$COMPOSE_FILE" ps
say "Traefik Pilot is configured for https://$DOMAIN"
say "Hostinger managed firewall: allow inbound TCP 22, 80, and 443 only. Do not expose 2375, 4000, 5432, or 8080."
say "Management command installed at $HOME/.local/bin/pilot. Add $HOME/.local/bin to PATH, then use: pilot status | doctor | logs | backup | update"
