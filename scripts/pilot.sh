#!/usr/bin/env sh
set -eu

find_root() {
  if [ -f "${PILOT_ROOT:-}/docker-compose.yml" ]; then printf '%s' "$PILOT_ROOT"; return; fi
  if [ -f ./docker-compose.yml ]; then pwd; return; fi
  if [ -f "$HOME/.config/traefik-pilot/root" ]; then
    configured_root=$(cat "$HOME/.config/traefik-pilot/root")
    if [ -f "$configured_root/docker-compose.yml" ]; then printf '%s' "$configured_root"; return; fi
  fi
  script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
  if [ -f "$script_dir/../docker-compose.yml" ]; then CDPATH= cd -- "$script_dir/.." && pwd; return; fi
  printf '%s' "$HOME/traefik-pilot"
}

ROOT=$(find_root)
COMPOSE="docker compose -f $ROOT/docker-compose.yml --project-directory $ROOT"
command=${1:-help}

case "$command" in
  status)
    $COMPOSE ps
    ;;
  doctor)
    echo "Traefik Pilot doctor"
    echo "===================="
    docker version --format 'Docker: {{.Server.Version}}' 2>/dev/null || echo "Docker: ERROR"
    docker compose version 2>/dev/null || true
    df -h / | awk 'NR==2{print "Disk: "$4" free of "$2}'
    free -h | awk '/^Mem:/{print "Memory: "$7" available of "$2}'
    $COMPOSE ps
    echo
    $COMPOSE exec -T api node -e "fetch('http://localhost:4000/api/system/health').then(async r=>{console.log(await r.text());process.exit(r.ok?0:1)})"
    ;;
  logs)
    service=${2:-api}
    $COMPOSE logs -f --tail=200 "$service"
    ;;
  restart)
    service=${2:-}
    if [ -n "$service" ]; then $COMPOSE restart "$service"; else $COMPOSE restart; fi
    ;;
  backup)
    stamp=$(date -u +%Y%m%dT%H%M%SZ)
    mkdir -p "$ROOT/backups"
    $COMPOSE exec -T db pg_dump -U pilot -d traefik_pilot | gzip > "$ROOT/backups/database-$stamp.sql.gz"
    $COMPOSE run --rm -T -v "$ROOT/backups:/export" api sh -c "tar czf /export/config-$stamp.tar.gz -C /data traefik backups"
    echo "Backup created in $ROOT/backups ($stamp)."
    ;;
  update)
    "$0" backup
    $COMPOSE pull --ignore-buildable
    $COMPOSE build --pull
    $COMPOSE up -d --remove-orphans
    $COMPOSE ps
    ;;
  recovery|restore-last-known-good)
    $COMPOSE exec -T api node dist/recovery.js
    ;;
  stop)
    $COMPOSE stop
    ;;
  start)
    $COMPOSE up -d
    ;;
  help|*)
    cat <<'EOF'
Usage: pilot <command>

  status                  Show service health
  doctor                  Check Docker, disk, memory, API and Traefik
  logs [service]          Follow logs (default: api)
  restart [service]       Restart one service or the stack
  backup                  Back up PostgreSQL and managed Traefik config
  update                  Back up, pull, rebuild and safely recreate
  restore-last-known-good Restore and verify the last healthy config
  stop | start            Stop or start the stack
EOF
    ;;
esac
