#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.prod}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or not in PATH."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: missing $ENV_FILE"
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

echo "Starting Jotly production services..."
"${COMPOSE_CMD[@]}" --env-file "$ENV_FILE" -f docker-compose.prod.yml -p "$COMPOSE_PROJECT_NAME" up -d --build --remove-orphans

echo "Jotly production services started."
