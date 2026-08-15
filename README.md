# Traefik Pilot

Traefik Pilot is a self-hosted administration and control plane for Traefik and Docker. It provides a simple route wizard for routine reverse-proxy work, advanced configuration previews, live infrastructure visibility, role-based access, and a fail-closed configuration pipeline with automatic rollback.

> Status: production-oriented reference implementation. Review the threat model, Docker socket permissions, backup mounts, and Traefik API exposure for your environment before operating public infrastructure.

## Fastest Hostinger VPS install

Choose Hostinger's **Ubuntu 24.04 with Docker** template, point an A record such as `pilot.example.com` to the VPS, copy this repository to the server, and run:

```bash
chmod +x install-hostinger.sh scripts/pilot.sh
./install-hostinger.sh
```

The installer creates strong secrets, validates DNS, builds the stack, provisions Traefik and Let's Encrypt, and installs a small `pilot` management command. Only ports 22, 80, and 443 need to be allowed by the Hostinger firewall. See [HOSTINGER.md](HOSTINGER.md) for the hPanel walkthrough, upgrades, backup strategy, and existing-Traefik option.

Routine operations are intentionally short:

```bash
pilot status
pilot doctor
pilot logs web
pilot backup
pilot update
pilot restore-last-known-good
```

## What is included

- React 19 + TypeScript responsive control panel with light, dark, and system-compatible styling
- Node.js/TypeScript REST API and OpenAPI UI at `/api/docs`
- PostgreSQL migrations for users, routes, middleware, settings, history, audit events, and notifications
- Docker discovery, inspect, logs, ports, networks, health, start, stop, and restart through a restricted socket proxy
- Traefik API discovery, router/service/middleware inventory, route tests, and generated dynamic YAML/Docker-label previews
- Nine-step route wizard and Simple/Advanced modes
- Validation for syntax, names, duplicate routers, conflicting hosts, containers, ports, networks, and TLS resolvers
- Backup-before-write, atomic configuration replacement, post-apply health verification, and automatic rollback
- AES-256-GCM secret encryption, bcrypt password hashing, signed HTTP-only sessions, CSRF checks, rate limits, Helmet headers, RBAC, and immutable audit events
- Configuration timeline, manual restore, and terminal recovery command
- Unit, API-oriented service, React component, and Playwright workflow tests

## Architecture

```text
Browser ──TLS──> Traefik ──> Web/nginx ──/api──> API
                                              ├── PostgreSQL
                                              ├── Traefik read API
                                              ├── restricted Docker socket proxy
                                              └── mounted dynamic-config + backups
```

The browser never receives Docker credentials or touches the Docker socket. The API is the authorization and policy boundary. Runtime state is queried from Docker/Traefik; managed intent and immutable change evidence are stored in PostgreSQL. Durable route changes are written to a mounted Traefik file-provider directory, not patched only into ephemeral container state.

## Requirements

- Ubuntu 22.04/24.04 or comparable Linux host
- Docker Engine 25+ with the Compose plugin
- For the standard Compose file: an existing Traefik 3.x instance, a shared file-provider directory, and the external network configured by `TRAEFIK_NETWORK` (defaults to `traefik-proxy`)
- For `docker-compose.hostinger.yml`: no existing reverse proxy is needed; the included Traefik owns ports 80/443

## Install

1. Clone/copy the repository and enter it.
2. Create the public network if it does not exist:

   ```bash
   docker network create traefik-public
   ```

3. Copy `.env.example` to `.env`. Generate strong values:

   ```bash
   openssl rand -base64 48   # JWT_SECRET
   openssl rand -hex 32      # ENCRYPTION_KEY
   openssl rand -base64 32   # POSTGRES_PASSWORD
   ```

4. Set `PILOT_DOMAIN`, `TRAEFIK_API_URL`, `TRAEFIK_DYNAMIC_HOST_DIR`, and `BACKUP_HOST_DIR`. The dynamic host directory must also be mounted into Traefik's configured `providers.file.directory`.
5. Start the stack:

   ```bash
   docker compose up -d --build
   ```

6. Open `https://$PILOT_DOMAIN`. The first-run endpoint permits exactly one administrator creation while the user table is empty. Complete Docker, Traefik, API, source discovery, backup, and health checks from Settings.

## Existing Traefik installations

Pilot reads routers, services, and middleware from the Traefik API and reads Traefik labels from Docker. It does not overwrite discovered configuration. Managed routes are placed in `pilot-managed.yml` under the configured file-provider directory.

Compose labels are identified through Docker's `com.docker.compose.project`, `com.docker.compose.service`, and `com.docker.compose.project.config_files` metadata. Treat those labels as source-owned: a runtime container update would disappear on `docker compose up`. Pilot therefore previews Docker labels but persists its own managed routes through the file provider. If source-Compose editing is later enabled, it should be a separately permissioned, Git-backed workflow with an explicit diff.

## Safe change and rollback

Every managed apply follows this sequence:

1. Read and snapshot the current managed configuration.
2. Validate the proposed model and generated YAML.
3. Refuse invalid names, conflicting host rules, missing containers, invalid ports/networks, middleware references, and incomplete TLS configuration.
4. Write a temporary file with mode `0600`, then atomically rename it.
5. Wait for the file provider and query the Traefik API.
6. Confirm the expected router loaded.
7. If verification fails, atomically restore the snapshot and record `rolled_back` with the cause.

Manual restore is administrator-only. Emergency terminal recovery restores the newest known-good revision and verifies Traefik:

```bash
docker compose exec api node dist/recovery.js
# or
make recovery
```

If the Traefik API itself is unavailable, recovery refuses to claim success even though it restores the file. Inspect `docker compose logs traefik api` and verify the file-provider mount.

## Authentication and roles

- **Administrator:** full control, users, secrets, settings, and restores.
- **Operator:** routes, middleware, route tests, and allowed container lifecycle actions.
- **Viewer:** read-only access.

Passwords use bcrypt cost 12. Sessions are signed, HTTP-only, `SameSite=Strict`, secure in production, and expire after eight hours. Mutations require a matching double-submit CSRF token. Login endpoints have brute-force rate limiting. Secret settings are AES-256-GCM encrypted and return only `••••••••` after saving.

## Docker permissions and tradeoffs

`docker-socket-proxy` reduces the Docker API surface, but any principal permitted to create or mutate sufficiently privileged containers can often escalate to host root. Pilot intentionally does **not** expose create, exec, image, build, volume, secret, swarm, or system endpoints. Operators only receive selected existing-container lifecycle actions. Keep the proxy on the internal network and never publish port 2375.

The Docker socket mount remains a high-value capability even when read-only. Pin and monitor the proxy image, restrict membership in the Docker group, and consider a rootless or remote authorization-plugin design for stricter environments.

## Traefik requirements

Example static configuration:

```yaml
api:
  dashboard: true
  insecure: false
providers:
  docker:
    exposedByDefault: false
    network: traefik-public
  file:
    directory: /etc/traefik/dynamic
    watch: true
entryPoints:
  web:
    address: :80
  websecure:
    address: :443
```

Expose the Traefik API to Pilot on a private network, never directly to the internet. Mount the same host dynamic directory to Traefik at `/etc/traefik/dynamic` and Pilot at `/data/traefik/dynamic`.

## Certificates

Certificate resolvers remain Traefik static configuration. Pilot stores resolver metadata and encrypted DNS tokens but never returns secret values. Prefer Docker secrets or a dedicated secret manager for DNS credentials; environment variables can be inspected by sufficiently privileged Docker users. Expiration bands are healthy (>30 days), warning (30/14/7 day thresholds), and error (expired or within the configured critical window).

## Development

```bash
corepack enable
pnpm install
pnpm dev
```

The web app is at `http://localhost:5173`, the API at `http://localhost:4000`, and API docs at `http://localhost:4000/api/docs`. Start PostgreSQL separately or use `docker compose up db docker-socket-proxy`.

## Tests and verification

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @pilot/web test:e2e
docker compose config
```

The safety tests explicitly verify that invalid configuration is not applied and that a failed post-apply health check receives the exact prior snapshot. Docker integration is adapter-based so production access remains behind authorization and tests can supply controlled fixtures.

## Backups

Snapshots are stored both in PostgreSQL history and as mode-`0600` files in `BACKUP_DIR`. Put that directory on encrypted, separately backed-up storage. Restores are audited. Test recovery regularly; a backup that has never been restored is only a hypothesis.

## Updating

1. Back up PostgreSQL and `BACKUP_DIR`.
2. Review release notes and migrations.
3. `docker compose pull && docker compose build --pull`.
4. `docker compose up -d`.
5. Check `/api/system/health`, the dashboard, route inventory, and a test route.

Migrations are idempotent and run before the API starts. For zero-downtime deployments, run migrations as a separate job and replace the web/API containers behind Traefik.

## Troubleshooting

- **Docker unavailable:** check the proxy container, internal network, and allowed endpoint environment flags. Never work around this by publishing the Docker socket.
- **Traefik unavailable:** check `TRAEFIK_API_URL`, private network attachment, and that `api.insecure` is not being used publicly.
- **Router not loaded:** inspect the apply history, `pilot-managed.yml`, Traefik logs, and file-provider mount. Pilot should show `ROLLBACK PERFORMED` with the verification cause.
- **Route works until Compose restart:** it was likely a runtime-only label change. Persist with Pilot's file-provider strategy or edit the source Compose file.
- **Certificate missing:** verify DNS, challenge reachability, resolver static configuration, and DNS token scope.
- **Database migration failure:** verify `DATABASE_URL`, PostgreSQL health, and volume permissions; the API fails closed rather than starting without persistence.

## API areas

REST resources include `/auth`, `/users`, `/containers`, `/routers`, `/services`, `/middleware`, `/domains`, `/certificates`, `/logs`, `/backups`, `/system`, `/settings`, and `/audit`. The live health stream uses Server-Sent Events at `/api/events`. See `/api/docs` or `/api/openapi.json` for the current contract.

## Security checklist

- Keep the app and Traefik API on private networks; expose only the web service through TLS.
- Replace every `.env.example` secret and set restrictive file permissions.
- Do not grant viewer/operator accounts administrator capabilities.
- Keep automatic rollback and health verification enabled.
- Send PostgreSQL and backup data to encrypted off-host backups.
- Review audit events, login failures, 5xx notifications, and certificate warnings.
- Update pinned base images and run dependency/container scans in CI.

Licensed for use and modification under the MIT license.
