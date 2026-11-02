#!/bin/sh
set -eu

# Extract on local storage: this preserves pnpm links and avoids slow shared-disk reads.
applicationDirectory="$(mktemp -d /tmp/capstone.XXXXXX)"
tar -xzf /home/site/wwwroot/application.tar.gz -C "$applicationDirectory"
cd "$applicationDirectory"
export NODE_ENV=production HOST=0.0.0.0
export PORT="${PORT:-8080}"
exec node build
