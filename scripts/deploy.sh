#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.prod}"
BRANCH="${1:-main}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or not in PATH."
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "Error: git is not installed or not in PATH."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f .env.prod.example ]]; then
    cp .env.prod.example "$ENV_FILE"
    echo "Created $ENV_FILE from .env.prod.example."
    echo "Update $ENV_FILE with production secrets, then rerun."
    exit 1
  fi

  echo "Error: missing $ENV_FILE"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: git working tree is not clean. Commit/stash changes before deploy."
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "Error: Docker Compose is not available."
  exit 1
fi

read_env_value() {
  local key="$1"
  local file="$2"
  local raw
  raw="$(grep -E "^[[:space:]]*${key}=" "$file" | tail -n 1 | cut -d '=' -f 2- || true)"
  raw="${raw%%#*}"
  raw="${raw%"${raw##*[![:space:]]}"}"
  raw="${raw#\"}"
  raw="${raw%\"}"
  raw="${raw#\'}"
  raw="${raw%\'}"
  printf "%s" "$raw"
}

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(read_env_value COMPOSE_PROJECT_NAME "$ENV_FILE")}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-jotly_prod}"
FRONTEND_HOST_PORT="${FRONTEND_HOST_PORT:-$(read_env_value FRONTEND_HOST_PORT "$ENV_FILE")}"
FRONTEND_HOST_PORT="${FRONTEND_HOST_PORT:-3100}"

show_compose_logs() {
  echo "Recent Docker Compose logs:"
  "${COMPOSE_CMD[@]}" --env-file "$ENV_FILE" -f docker-compose.prod.yml -p "$COMPOSE_PROJECT_NAME" logs --tail=120 backend frontend postgres || true
}

echo "Deploying branch '$BRANCH' from GitHub..."
git fetch --all --prune

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git checkout "$BRANCH"
else
  git checkout -b "$BRANCH" "origin/$BRANCH"
fi

git pull --ff-only origin "$BRANCH"

echo "Building and starting containers..."
"${COMPOSE_CMD[@]}" --env-file "$ENV_FILE" -f docker-compose.prod.yml -p "$COMPOSE_PROJECT_NAME" up -d --build --remove-orphans

echo "Deployment command finished."

if command -v curl >/dev/null 2>&1; then
  echo "Waiting for health endpoint..."
  for attempt in {1..30}; do
    if curl -fsS "http://127.0.0.1:${FRONTEND_HOST_PORT}/backend-api/health" >/dev/null; then
      echo "Health check passed on attempt $attempt."
      break
    fi

    if [[ "$attempt" -eq 30 ]]; then
      echo "Warning: health check did not pass yet: http://127.0.0.1:${FRONTEND_HOST_PORT}/backend-api/health"
      show_compose_logs
      exit 1
    fi

    sleep 2
  done
fi

echo "Jotly is deployed on internal port ${FRONTEND_HOST_PORT}."
echo "Configure Nginx server_name to proxy to http://127.0.0.1:${FRONTEND_HOST_PORT}."
