#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or not in PATH."
  exit 1
fi

if [[ ! -f .env && -f .env.example ]]; then
  cp .env.example .env
  echo "Created .env from .env.example."
fi

TEMP_DOCKER_CONFIG=""
cleanup() {
  if [[ -n "$TEMP_DOCKER_CONFIG" && -d "$TEMP_DOCKER_CONFIG" ]]; then
    rm -rf "$TEMP_DOCKER_CONFIG"
  fi
}
trap cleanup EXIT

DOCKER_CONFIG_DIR="${DOCKER_CONFIG:-$HOME/.docker}"
DOCKER_CONFIG_FILE="$DOCKER_CONFIG_DIR/config.json"
if [[ -f "$DOCKER_CONFIG_FILE" ]] \
  && grep -Eq '"credsStore"[[:space:]]*:[[:space:]]*"desktop"' "$DOCKER_CONFIG_FILE" \
  && ! command -v docker-credential-desktop >/dev/null 2>&1; then
  TEMP_DOCKER_CONFIG="$(mktemp -d)"

  # Keep user-level Docker CLI plugins (including compose) available.
  if [[ -d "$DOCKER_CONFIG_DIR/cli-plugins" ]]; then
    ln -s "$DOCKER_CONFIG_DIR/cli-plugins" "$TEMP_DOCKER_CONFIG/cli-plugins"
  fi

  if [[ -d "$DOCKER_CONFIG_DIR/contexts" ]]; then
    ln -s "$DOCKER_CONFIG_DIR/contexts" "$TEMP_DOCKER_CONFIG/contexts"
  fi

  CURRENT_CONTEXT="$(sed -nE 's/^[[:space:]]*"currentContext"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' "$DOCKER_CONFIG_FILE" | head -n 1)"
  if [[ -n "$CURRENT_CONTEXT" ]]; then
    printf '{ "auths": {}, "currentContext": "%s" }\n' "$CURRENT_CONTEXT" > "$TEMP_DOCKER_CONFIG/config.json"
  else
    printf '{ "auths": {} }\n' > "$TEMP_DOCKER_CONFIG/config.json"
  fi

  export DOCKER_CONFIG="$TEMP_DOCKER_CONFIG"
  echo "Warning: docker-credential-desktop is referenced but unavailable."
  echo "Using a temporary Docker config for this run."
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "Error: Docker Compose is not available."
  exit 1
fi

echo "Starting Jotly services with Docker Compose..."
"${COMPOSE_CMD[@]}" up --build -d

echo "Jotly is running."
echo "Frontend: http://localhost:3000"
echo "Backend health: http://localhost:3001/api/health"
