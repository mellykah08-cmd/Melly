# Sofia Claw3D — build reprodutível

- Upstream Claw3D fixado em `claw3d/UPSTREAM_COMMIT`.
- Cadeia de patches: `claw3d/apply-chain.sh` (v1 → health → v2 → v2.1 → v2.2 → v2.3 → v2.4 → v2.5 → v2.6).
- Assets que antes vinham de CDN em runtime (HDR do ambiente e fonte Latin do texto 3D) são baixados no build por `claw3d/fetch-assets.sh`, com sha256 fixado.
- Imagem: `claw3d/Dockerfile` (contexto = raiz do repo). Tudo compila no build da imagem; o container só executa `node server/index.js`.

## Testar localmente (checkout limpo)

```sh
curl -fsSL https://codeload.github.com/iamlukethedev/Claw3D/tar.gz/$(cat claw3d/UPSTREAM_COMMIT) | tar -xz
cd Claw3D-* && npm ci --ignore-scripts
sh ../claw3d/apply-chain.sh ../claw3d v2.6 && npx tsc --noEmit && npx next build --webpack
```

`apply-chain.sh <dir> v2.1` reproduz a base anterior; qualquer estágio intermediário (v2.2…v2.5) pode ser testado isoladamente.
