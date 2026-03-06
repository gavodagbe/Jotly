#!/usr/bin/env bash

set -euo pipefail

MODE="${1:-http}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.prod}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Error: run this script as root (use sudo)."
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "Error: nginx is not installed on this VM."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: missing env file: $ENV_FILE"
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

APP_DOMAIN="${APP_DOMAIN:-$(read_env_value APP_DOMAIN "$ENV_FILE")}"
FRONTEND_HOST_PORT="${FRONTEND_HOST_PORT:-$(read_env_value FRONTEND_HOST_PORT "$ENV_FILE")}"
APP_DOMAIN="${APP_DOMAIN:-jotly.godwinavodagbe.com}"
FRONTEND_HOST_PORT="${FRONTEND_HOST_PORT:-3100}"

SITE_AVAILABLE="/etc/nginx/sites-available/${APP_DOMAIN}.conf"
SITE_ENABLED="/etc/nginx/sites-enabled/${APP_DOMAIN}.conf"

write_http_only_config() {
  cat > "$SITE_AVAILABLE" <<CONFIG
server {
    listen 80;
    listen [::]:80;
    server_name ${APP_DOMAIN};

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:${FRONTEND_HOST_PORT};
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
CONFIG
}

write_https_config() {
  local cert_dir="/etc/letsencrypt/live/${APP_DOMAIN}"
  local cert_fullchain="${cert_dir}/fullchain.pem"
  local cert_privkey="${cert_dir}/privkey.pem"

  if [[ ! -f "$cert_fullchain" || ! -f "$cert_privkey" ]]; then
    echo "Error: certificate files not found for ${APP_DOMAIN}."
    echo "Run: certbot --nginx -d ${APP_DOMAIN}"
    exit 1
  fi

  cat > "$SITE_AVAILABLE" <<CONFIG
server {
    listen 80;
    listen [::]:80;
    server_name ${APP_DOMAIN};

    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${APP_DOMAIN};

    ssl_certificate ${cert_fullchain};
    ssl_certificate_key ${cert_privkey};
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 20m;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;

    location / {
        proxy_pass http://127.0.0.1:${FRONTEND_HOST_PORT};
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
CONFIG
}

case "$MODE" in
  http)
    write_http_only_config
    ;;
  https)
    write_https_config
    ;;
  *)
    echo "Error: unknown mode '$MODE'. Use: http | https"
    exit 1
    ;;
esac

if [[ ! -L "$SITE_ENABLED" ]]; then
  ln -s "$SITE_AVAILABLE" "$SITE_ENABLED"
fi

nginx -t
systemctl reload nginx

echo "Nginx site updated: $SITE_AVAILABLE"
echo "Mode: $MODE"
echo "Domain: $APP_DOMAIN"
echo "Upstream: http://127.0.0.1:${FRONTEND_HOST_PORT}"
