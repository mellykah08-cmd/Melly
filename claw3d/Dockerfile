# Sofia Claw3D — reproducible build.
# Everything (download, patch chain, next build) happens at IMAGE BUILD time:
# a failed build never replaces the running deployment, and restarts/wake-ups
# take seconds instead of a full rebuild.
# Railway: dockerfilePath=claw3d/Dockerfile, build context = repo root.
FROM node:22-bookworm-slim

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/claw3d

# Pinned upstream Claw3D commit (see claw3d/UPSTREAM_COMMIT).
ARG CLAW3D_COMMIT=0565b7892909eca7bbc8f2d9b0fad171dd75ad7c
RUN curl -fsSL --retry 4 --retry-delay 3 \
      "https://codeload.github.com/iamlukethedev/Claw3D/tar.gz/${CLAW3D_COMMIT}" -o /tmp/claw3d.tgz \
  && tar -xzf /tmp/claw3d.tgz --strip-components=1 -C /opt/claw3d \
  && rm /tmp/claw3d.tgz

RUN npm ci --ignore-scripts --no-audit --no-fund

COPY claw3d /opt/sofia-patches

# Railway exposes service variables to the build when declared as ARG.
# Gateway URL/state dir seed the Studio settings (desk assignments, titles);
# the three SOFIA_*_JS values are the legacy variable-stored patches, applied
# in their historical position when present.
ARG OPENCLAW_STATE_DIR
ARG CLAW3D_GATEWAY_URL
ARG SOFIA_STORAGE_FIX_JS
ARG SOFIA_SETTINGS_FIX_JS
ARG SOFIA_HEALTH_PATCH_JS
ARG SOFIA_CHAIN_STAGE=v2.6
ENV NEXT_TELEMETRY_DISABLED=1

RUN sh /opt/sofia-patches/apply-chain.sh /opt/sofia-patches "${SOFIA_CHAIN_STAGE}"

# next/font fetches Google Fonts during the build; retry transient failures.
RUN for attempt in 1 2 3; do \
      NODE_ENV=production npx next build --webpack && exit 0; \
      echo "next build failed (attempt ${attempt}), retrying"; rm -rf .next; sleep 10; \
    done; exit 1

ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "HOST=0.0.0.0 PORT=3000 exec node server/index.js"]
