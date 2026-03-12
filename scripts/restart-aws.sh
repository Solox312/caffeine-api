#!/usr/bin/env bash
# Restart Caffeine API on AWS (EC2): rebuild image and run container.
# Usage: ./scripts/restart-aws.sh [--pull]
#   --pull  run git pull before rebuilding (optional)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE_NAME="caffeine-api:aws"
CONTAINER_NAME="caffeine-api"
ENV_FILE="$ROOT_DIR/.env"

cd "$ROOT_DIR"

if [[ "${1:-}" == "--pull" ]]; then
  echo "[restart] Pulling latest..."
  git pull
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[restart] WARNING: .env not found at $ENV_FILE"
  read -p "Continue anyway? [y/N] " -n 1 -r
  echo
  [[ "$REPLY" =~ ^[yY]$ ]] || exit 1
fi

echo "[restart] Building image $IMAGE_NAME..."
docker build -f Dockerfile.aws -t "$IMAGE_NAME" .

echo "[restart] Stopping existing container (if any)..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

echo "[restart] Starting $CONTAINER_NAME..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -p 3000:3000 \
  "$IMAGE_NAME"

echo "[restart] Done. Check: docker logs -f $CONTAINER_NAME"
