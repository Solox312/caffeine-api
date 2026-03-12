# Caffeine API – Scripts

## `logs-aws.sh`

Quick access to Nginx and API logs on EC2. See **[LOGS.md](LOGS.md)** for full details.

```bash
chmod +x scripts/logs-aws.sh
./scripts/logs-aws.sh api -f          # Follow API (Docker) logs
./scripts/logs-aws.sh nginx-error -f  # Follow Nginx error log
./scripts/logs-aws.sh all             # Last 50 lines of each
```

---

## `restart-aws.sh`

Restarts the Caffeine API on AWS (EC2 or any Linux host) by rebuilding the Docker image and running the container. Use this after code changes or a `git pull` so the running app uses the latest code.

### Prerequisites

- **Docker** installed and the current user can run `docker` (e.g. in `docker` group).
- **`.env`** in the project root with your API config (see repo root `.env.example` if present).
- Repo is the **caffeine-api** project root when the script runs (it `cd`s to the parent of `scripts/`).

### Usage

From the **caffeine-api** project root:

```bash
# Make executable (once)
chmod +x scripts/restart-aws.sh

# Rebuild and restart (no git pull)
./scripts/restart-aws.sh

# Pull latest code, then rebuild and restart
./scripts/restart-aws.sh --pull
```

Or from anywhere:

```bash
/path/to/caffeine-api/scripts/restart-aws.sh [--pull]
```

### What it does

1. **Optional** – If `--pull` is passed, runs `git pull` in the repo.
2. **Optional** – If `--cloudwatch` is passed, API logs are sent to CloudWatch (see [CLOUDWATCH.md](CLOUDWATCH.md)).
3. **Check** – Warns if `.env` is missing (and asks to continue or exit).
4. **Build** – `docker build -f Dockerfile.aws -t caffeine-api:aws .`
5. **Stop** – Stops and removes the existing container named `caffeine-api` (if present).
6. **Run** – Starts a new container with:
   - Name: `caffeine-api`
   - Restart: `unless-stopped`
   - Env: `--env-file .env`
   - Port: `3000:3000`

### Customization

Edit the variables at the top of `restart-aws.sh` if you use different names or paths:

| Variable           | Default             | Purpose                    |
|--------------------|---------------------|----------------------------|
| `IMAGE_NAME`       | `caffeine-api:aws`  | Docker image name/tag      |
| `CONTAINER_NAME`   | `caffeine-api`      | Running container name     |
| `ENV_FILE`         | `$ROOT_DIR/.env`    | Path to env file for Docker|

### After restart

- **Logs:** `docker logs -f caffeine-api` (or use CloudWatch; see [CLOUDWATCH.md](CLOUDWATCH.md))
- **Status:** `docker ps` (look for `caffeine-api`)
- **Health:** `curl http://localhost:3000/status` (or your server URL)

### CloudWatch (logs in AWS Console)

To send Nginx and API logs to CloudWatch so you can view them without SSH, see **[CLOUDWATCH.md](CLOUDWATCH.md)**. Then run:

```bash
./scripts/restart-aws.sh --cloudwatch   # API logs → CloudWatch
```

### Troubleshooting

- **“Cannot connect to Docker”** – Install Docker and ensure your user can run it (`sudo usermod -aG docker $USER` then log out/in, or run the script with `sudo` only if needed).
- **“.env not found”** – Create `.env` in the caffeine-api root or adjust `ENV_FILE` in the script.
- **Port 3000 in use** – Stop the process using port 3000 or change `-p 3000:3000` in the script (and in Nginx if you use it).
