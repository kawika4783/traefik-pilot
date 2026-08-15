.PHONY: install dev build test up down hostinger-up hostinger-doctor hostinger-backup migrate recovery
install:
	pnpm install
dev:
	pnpm dev
build:
	pnpm build
test:
	pnpm test
up:
	docker compose up -d --build
down:
	docker compose down
hostinger-up:
	docker compose -f docker-compose.hostinger.yml up -d --build
hostinger-doctor:
	./scripts/pilot.sh doctor
hostinger-backup:
	./scripts/pilot.sh backup
migrate:
	docker compose exec api node dist/migrate.js
recovery:
	docker compose exec api node dist/recovery.js
