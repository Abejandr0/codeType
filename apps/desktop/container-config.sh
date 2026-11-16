#!/bin/sh
set -eu

CODETYPE_API_URL="${CODETYPE_API_URL:-}"
envsubst '${CODETYPE_API_URL}' \
  < /usr/share/nginx/html/config.js.template \
  > /usr/share/nginx/html/config.js
