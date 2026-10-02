#!/bin/sh
# Applies the Sofia Claw3D patch chain to a clean Claw3D checkout (cwd).
# Usage: sh apply-chain.sh <patch-dir> [last-stage]
#   last-stage: v2.1 | v2.2 | v2.3 | v2.4 | v2.5 | v2.6 (default: v2.6)
# Optional legacy Railway-variable patches (SOFIA_STORAGE_FIX_JS,
# SOFIA_SETTINGS_FIX_JS, SOFIA_HEALTH_PATCH_JS) run in their historical
# position when present in the environment.
set -eu
DIR="${1:?patch dir required}"
LAST="${2:-v2.6}"

run_env_patch() {
  name="$1"
  eval "body=\${$name:-}"
  if [ -n "$body" ]; then
    printf '%s' "$body" > "/tmp/sofia-$name.js"
    node "/tmp/sofia-$name.js"
    rm -f "/tmp/sofia-$name.js"
  else
    echo "SOFIA_CHAIN: $name not set, skipped"
  fi
}

node "$DIR/patch-building-v1.js"
run_env_patch SOFIA_STORAGE_FIX_JS
run_env_patch SOFIA_SETTINGS_FIX_JS
run_env_patch SOFIA_HEALTH_PATCH_JS
node "$DIR/patch-health.js"
node "$DIR/patch-ops-v2.js"
node "$DIR/patch-ops-v2.1.js"
for stage in v2.2 v2.3 v2.4 v2.5 v2.6; do
  case "$LAST" in v2.1) break ;; esac
  [ "$stage" = "v2.6" ] && sh "$DIR/fetch-assets.sh"
  node "$DIR/patch-ops-$stage.js"
  [ "$stage" = "$LAST" ] && break
done
echo "SOFIA_CHAIN_OK: applied through $LAST"
