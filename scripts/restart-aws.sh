#!/usr/bin/env bash
# Restart Caffeine API on AWS (EC2): rebuild image and run container.
# Usage: ./scripts/restart-aws.sh [--pull] [--cloudwatch]
#   --pull       run git pull before rebuilding (optional)
#   --cloudwatch send API logs to CloudWatch (requires IAM + AWS_REGION)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE_NAME="caffeine-api:aws"
CONTAINER_NAME="caffeine-api"
ENV_FILE="$ROOT_DIR/.env"
CLOUDWATCH_LOG_GROUP="${CLOUDWATCH_LOG_GROUP:-/aws/ec2/caffeine-api/api}"
AWS_REGION="${AWS_REGION:-us-east-1}"

DO_PULL=""
USE_CLOUDWATCH=""
for arg in "$@"; do
  case "$arg" in
    --pull) DO_PULL=1 ;;
    --cloudwatch) USE_CLOUDWATCH=1 ;;
  esac
done

cd "$ROOT_DIR"

if [[ -n "$DO_PULL" ]]; then
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
DOCKER_LOGS_OPTS=()
if [[ -n "$USE_CLOUDWATCH" ]]; then
  DOCKER_LOGS_OPTS=(
    --log-driver awslogs
    --log-opt "awslogs-region=$AWS_REGION"
    --log-opt "awslogs-group=$CLOUDWATCH_LOG_GROUP"
    --log-opt "awslogs-stream-prefix=api"
  )
  echo "[restart] CloudWatch logging enabled -> $CLOUDWATCH_LOG_GROUP"
fi

docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -p 3000:3000 \
  "${DOCKER_LOGS_OPTS[@]}" \
  "$IMAGE_NAME"

echo "[restart] Done."
if [[ -n "$USE_CLOUDWATCH" ]]; then
  echo "[restart] API logs: AWS Console -> CloudWatch -> Log groups -> $CLOUDWATCH_LOG_GROUP"
else
  echo "[restart] API logs: docker logs -f $CONTAINER_NAME"
fi
