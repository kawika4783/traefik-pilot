# Hostinger VPS deployment

This is the recommended production path for a new Hostinger VPS. It runs Traefik Pilot, Traefik, PostgreSQL, and a restricted Docker socket proxy as one Docker Compose project. Traefik is the only public-facing container.

## Before you begin

1. In hPanel, install the **Ubuntu 24.04 with Docker** VPS template.
2. Create an A record such as `pilot.example.com` pointing to the VPS IPv4 address.
3. In the Hostinger VPS firewall, allow inbound TCP 22, 80, and 443. Do not expose 2375, 4000, 5432, or 8080.
4. Copy or clone this repository to the VPS and enter the directory.

The VPS needs at least 2 GB RAM for comfortable operation. Four GB is a better baseline when it also hosts application containers.

## One-command installation

```bash
chmod +x install-hostinger.sh scripts/pilot.sh
./install-hostinger.sh
```

The installer asks for the admin domain and Let's Encrypt email, creates `.env` with mode 600, generates the database, session, and encryption secrets, checks DNS, validates Compose, and starts the stack. It also installs `pilot` in `$HOME/.local/bin`. If that directory is not already on the shell path:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.profile"
. "$HOME/.profile"
```

Open `https://your-domain`. The first-run flow creates the only initial administrator account.

## Daily administration

```bash
pilot status                         # service and health state
pilot doctor                         # Docker, disk, memory, API, and Traefik checks
pilot logs api                       # follow recent logs for one service
pilot restart web                    # restart one service
pilot backup                         # database and managed-config archive
pilot update                         # backup, pull, rebuild, and recreate
pilot restore-last-known-good        # emergency configuration rollback
```

Backups are written to `backups/` beside the project. Copy them to encrypted off-VPS storage on a schedule; VPS snapshots alone are not a substitute for application-level backups.

## Hostinger Docker Manager

You can import the repository's default `docker-compose.yml` using **Compose from URL**. It pulls public prebuilt API and web images, so Docker Manager does not need the repository's Dockerfiles or an `.env` file. Set `PILOT_DOMAIN`, `ACME_EMAIL`, `POSTGRES_PASSWORD`, `JWT_SECRET`, and `ENCRYPTION_KEY` in Docker Manager before deployment. The YAML preview must list exactly `traefik`, `db`, `docker-socket-proxy`, `api`, and `web`. If it shows Redis or declares an external network named `traefik`, the wrong Compose source is selected.

Use this public URL:

```text
https://raw.githubusercontent.com/kawika4783/traefik-pilot/refs/heads/main/docker-compose.yml
```

`JWT_SECRET` should contain at least 32 random characters. `ENCRYPTION_KEY` must contain exactly 64 hexadecimal characters. For example, generate them with `openssl rand -hex 48` and `openssl rand -hex 32`.

## Hosting other Compose projects

The included Traefik listens on ports 80 and 443 and uses the `pilot-edge` network. To expose a separate project, attach its web service to that external network and add Traefik labels. Create the network only if Pilot is not already running:

```bash
docker network create pilot-edge
```

Example application service:

```yaml
services:
  app:
    image: your-image:tag
    networks: [pilot-edge]
    labels:
      - traefik.enable=true
      - traefik.http.routers.app.rule=Host(`app.example.com`)
      - traefik.http.routers.app.entrypoints=websecure
      - traefik.http.routers.app.tls.certresolver=letsencrypt
      - traefik.http.services.app.loadbalancer.server.port=3000

networks:
  pilot-edge:
    external: true
```

The Pilot route wizard is the safer day-to-day path because it validates the target, snapshots the current configuration, applies atomically, verifies Traefik, and automatically rolls back a failed change.

## Existing Hostinger Traefik installation

If another Traefik project already owns ports 80/443, use `docker-compose.existing-traefik.yml` instead. Set `TRAEFIK_NETWORK` to that project's shared external network (Hostinger commonly documents `traefik-proxy`), set the private `TRAEFIK_API_URL`, and mount the same file-provider directory into Pilot and Traefik. Never run two reverse proxies on the same public ports.

## Deployment error: external Traefik network not found

The default Compose file does not declare an external network. If a build reports `network traefik declared as external, but could not be found`, Docker Manager loaded another project's Compose configuration or the advanced existing-Traefik file. Remove the failed project and redeploy from this repository's root `docker-compose.yml`. Do not create the missing network unless you intentionally operate a separate Traefik project that owns ports 80/443.

## Recovery

If the dashboard is unreachable:

```bash
pilot doctor
pilot logs traefik
pilot logs api
pilot restore-last-known-good
```

If certificates are not issuing, confirm the A record points to this VPS and that TCP 80 and 443 are reachable. If the database is unhealthy, inspect `pilot logs db` and verify free disk space with `pilot doctor`.

To stop without deleting data:

```bash
pilot stop
```

Do not use `docker compose down -v` unless you intentionally want to delete the database, certificate store, configuration, and backups held in Docker volumes.
