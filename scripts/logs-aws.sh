#!/usr/bin/env bash
# Easy access to Nginx and Caffeine API logs on AWS/EC2.
# Usage: ./scripts/logs-aws.sh [nginx-access|nginx-error|api|all] [-f|--follow]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTAINER_NAME="caffeine-api"

NGINX_ACCESS="/var/log/nginx/access.log"
NGINX_ERROR="/var/log/nginx/error.log"

FOLLOW=""
TYPE="${1:-api}"

for arg in "$@"; do
  case "$arg" in
    -f|--follow) FOLLOW="-f" ;;
    nginx-access|nginx-error|api|all) TYPE="$arg" ;;
  esac
done

# If first arg is -f/--follow, second is type
if [[ "$1" == "-f" || "$1" == "--follow" ]]; then
  FOLLOW="-f"
  TYPE="${2:-api}"
fi

run_tail() {
  local file="$1"
  if [[ -f "$file" ]]; then
    if [[ -n "$FOLLOW" ]]; then
      sudo tail -f "$file"
    else
      sudo tail -n 100 "$file"
    fi
  else
    echo "Log file not found: $file" >&2
    exit 1
  fi
}

case "$TYPE" in
  nginx-access)
    run_tail "$NGINX_ACCESS"
    ;;
  nginx-error)
    run_tail "$NGINX_ERROR"
    ;;
  api)
    if [[ -n "$FOLLOW" ]]; then
      docker logs -f "$CONTAINER_NAME"
    else
      docker logs --tail 100 "$CONTAINER_NAME"
    fi
    ;;
  all)
    echo "=== Last 50 lines each - use -f with nginx-access, nginx-error, or api for live tail ==="
    echo "--- Nginx access ---"
    sudo tail -n 50 "$NGINX_ACCESS" 2>/dev/null || echo "no access log"
    echo "--- Nginx error ---"
    sudo tail -n 50 "$NGINX_ERROR" 2>/dev/null || echo "no error log"
    echo "--- API Docker ---"
    docker logs --tail 50 "$CONTAINER_NAME" 2>/dev/null || echo "container not running"
    ;;
  *)
    echo "Usage: $0 [nginx-access|nginx-error|api|all] [-f|--follow]"
    echo ""
    echo "  nginx-access   Nginx access log - requests"
    echo "  nginx-error    Nginx error log"
    echo "  api            Caffeine API container logs - Docker"
    echo "  all            Last 50 lines of each - no -f"
    echo ""
    echo "  -f, --follow   Keep streaming. Use with one of the first four options."
    echo ""
    echo "Examples:"
    echo "  $0 api -f"
    echo "  $0 nginx-error -f"
    echo "  $0 all"
    exit 1
    ;;
esac
