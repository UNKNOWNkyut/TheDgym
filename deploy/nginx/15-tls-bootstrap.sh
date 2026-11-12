#!/bin/sh
set -eu

DOMAIN="${SITE_DOMAIN:-thedgym.com}"
LE_DIR="/etc/letsencrypt/live/${DOMAIN}"
CERT_DIR="/etc/nginx/certs"

mkdir -p "$CERT_DIR" /var/www/certbot

if [ -s "$LE_DIR/fullchain.pem" ] && [ -s "$LE_DIR/privkey.pem" ]; then
    ln -sf "$LE_DIR/fullchain.pem" "$CERT_DIR/fullchain.pem"
    ln -sf "$LE_DIR/privkey.pem" "$CERT_DIR/privkey.pem"
    echo "[tls-bootstrap] Using Let's Encrypt certificate for ${DOMAIN}"
elif [ ! -s "$CERT_DIR/fullchain.pem" ] || [ ! -s "$CERT_DIR/privkey.pem" ]; then
    openssl req -x509 -nodes -newkey rsa:2048 -days 7 \
        -keyout "$CERT_DIR/privkey.pem" \
        -out "$CERT_DIR/fullchain.pem" \
        -subj "/CN=${DOMAIN}" >/dev/null 2>&1
    echo "[tls-bootstrap] WARNING: Using temporary self-signed certificate for ${DOMAIN}. Run certbot for production TLS."
fi
