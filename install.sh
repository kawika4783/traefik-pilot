#!/usr/bin/env sh
set -eu
command -v docker >/dev/null 2>&1 || { echo "Docker is required" >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose plugin is required" >&2; exit 1; }
[ -f .env ] || { cp .env.example .env; echo "Created .env. Set all secrets and deployment paths, then run this script again."; exit 1; }
grep -q 'change-me\|replace-with' .env && { echo "Refusing to start with example secrets." >&2; exit 1; }
docker network inspect traefik-public >/dev/null 2>&1 || docker network create traefik-public >/dev/null
mkdir -p pilot-data/dynamic pilot-data/backups
docker compose up -d --build
docker compose ps
