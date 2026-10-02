#!/bin/sh
# Self-host the runtime assets the 3D office would otherwise pull from public
# CDNs on every visit (raw.githack.com, cdn.jsdelivr.net). Each file is pinned
# by sha256. Non-fatal: when a download fails, patch-ops-v2.6.js keeps the CDN
# behaviour for that asset (inside error/suspense boundaries).
set -u

fetch() {
  dest="$1"; url="$2"; sha="$3"
  mkdir -p "$(dirname "$dest")"
  if curl -fsSL --retry 4 --retry-delay 2 -o "$dest.tmp" "$url" \
    && echo "$sha  $dest.tmp" | sha256sum -c - >/dev/null 2>&1; then
    mv "$dest.tmp" "$dest"
    echo "SOFIA_ASSETS_OK: $dest"
  else
    rm -f "$dest.tmp"
    echo "SOFIA_ASSETS_WARN: $dest not self-hosted, CDN kept"
  fi
}

# drei <Environment preset="city"> HDR.
fetch public/sofia-assets/potsdamer_platz_1k.hdr \
  https://raw.githack.com/pmndrs/drei-assets/456060a26bbeb8fdf79326f224b6d99b8bcce736/hdri/potsdamer_platz_1k.hdr \
  7afe4c2f9700ee78c7477c53fa355463d7dda1fdede401432d6b5f9ff0a95696

# troika-three-text fallback font for U+0000-00FF (all pt-BR accents), the same
# file unicode-font-resolver would fetch from jsDelivr for drei <Text>.
fetch public/sofia-assets/fonts/latin-sans-400.woff \
  https://cdn.jsdelivr.net/gh/lojjic/unicode-font-resolver@v1.0.1/packages/data/font-files/latin/sans-serif.normal.400.woff \
  f7f64a47de4b18ea368a75e3ee3d03ba1a9d6853c238cf7160816e25f45a7cb7
