#!/bin/sh
# Quick start for the Sofia Claw3D Spatial OS (local, no secrets needed).
#   sh claw3d/init.sh [workdir]        -> prepares upstream + chain + build
#   WORK=<dir> sh claw3d/init.sh run   -> starts demo gateway + studio on :3100
#   WORK=<dir> sh claw3d/init.sh test  -> unit tests + spatial E2E
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${WORK:-${1:-/tmp/sofia-claw3d}}"
case "${1:-prepare}" in
  run)
    cd "$WORK"
    NODE_PATH="$WORK/node_modules" nohup node "$HERE/tests/sofia-demo-gateway.js" > "$WORK/demo-gw.log" 2>&1 &
    mkdir -p "$WORK/.state"
    OPENCLAW_STATE_DIR="$WORK/.state" CLAW3D_GATEWAY_URL=ws://127.0.0.1:18789 CLAW3D_GATEWAY_ADAPTER_TYPE=openclaw \
      UPSTREAM_ALLOWLIST=127.0.0.1,localhost STUDIO_ACCESS_TOKEN=local-test-token SOFIA_OPS_EVENT_TOKEN=local-event-token \
      NODE_ENV=production HOST=127.0.0.1 PORT=3100 nohup node server/index.js > "$WORK/studio.log" 2>&1 &
    for i in $(seq 1 40); do curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3100/healthz | grep -q 200 && break; sleep 1; done
    echo "studio: http://127.0.0.1:3100/office (cookie studio_access=local-test-token)"
    ;;
  test)
    cd "$WORK"
    npx vitest run tests/unit/sofiaWorldState.test.ts
    node "$HERE/tests/e2e-spatial.js" http://127.0.0.1:3100 local
    ;;
  *)
    COMMIT="$(cat "$HERE/UPSTREAM_COMMIT")"
    mkdir -p "$WORK"
    curl -fsSL "https://codeload.github.com/iamlukethedev/Claw3D/tar.gz/$COMMIT" | tar -xz --strip-components=1 -C "$WORK"
    cd "$WORK"
    npm ci --ignore-scripts --no-audit --no-fund
    sh "$HERE/apply-chain.sh" "$HERE"
    NODE_ENV=production npx next build --webpack
    echo "prepared $WORK — next: WORK=$WORK sh $HERE/init.sh run"
    ;;
esac
