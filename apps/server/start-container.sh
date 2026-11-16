#!/bin/sh
set -eu

exec node apps/server/dist/src/index.js
