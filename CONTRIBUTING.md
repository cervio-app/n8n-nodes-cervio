# Contributing

## Development

```bash
npm install
npm run build
npm test
npm run verify
npm run lint
```

`npm run lint` runs TypeScript (`tsc --noEmit`) and ESLint (`@n8n/eslint-plugin-community-nodes`).

`.npmrc` sets `ignore-scripts=true` so `n8n-workflow` (devDependency for types) does not build native `isolated-vm`. Runtime n8n still provides the real package.

### Live smoke (manual — not in CI)

Smoke scripts hit a real Cervio tenant and need a PAT plus **your** entity UUIDs. They are **not** part of PR CI. The repo ships no lab/tenant defaults — copy [`.env.example`](./.env.example) and fill every required `CERVIO_SMOKE_*` id.

```bash
cp .env.example .env   # gitignored; export or source before running
# CERVIO_BASE_URL, CERVIO_PAT, CERVIO_SMOKE_ENTITY_ID required for smoke / smoke:extended
npm run smoke
npm run smoke:extended
npm run smoke:relations   # needs the full CERVIO_SMOKE_* entity map in .env.example
```

Local n8n against this package via Compose:

```bash
npm run build
docker compose -f compose.yaml up
# → http://localhost:5678
```

## Commits

[Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`.

Examples: `feat: add upsert record operation`, `fix: coerce relation id on update`.

## Pull requests

1. Branch from `main`
2. Stay REST-only (`/api/v1`) — no MCP/Edge calls from this package
3. CI must pass (`lint`, `build`, `test`, `verify`)
4. Update `README.md` when operations change
5. Keep unit tests next to the node under `nodes/Cervio/__tests__/`
6. Update `CHANGELOG.md` `[Unreleased]` for user-facing changes

## Versioning and tags

Keep these three equal for every release:

| Source | Example |
|--------|---------|
| `package.json` `version` | `0.2.5` |
| Annotated git tag | `v0.2.5` |
| npm `@cervio/n8n-nodes-cervio` | `0.2.5` |

- Never move or delete a published `v*` tag
- Pushing a `v*.*.*` tag runs [.github/workflows/publish.yml](./.github/workflows/publish.yml) (npm Trusted Publishing via OIDC + provenance, then GitHub Release). If that version is already on npm, the job skips publish and still ensures a GitHub Release exists.
- **Provenance:** enabled (`npm publish --provenance`). The GitHub source repository must stay **public**.

### Cut a release

```bash
# from a clean main, after features are merged
# 1. Move CHANGELOG [Unreleased] → new version section
npm version patch   # or minor / major — bumps package.json, commits, tags vX.Y.Z
git push origin main --follow-tags
# publish.yml publishes to npm and creates the GitHub Release
```

npm Trusted Publishing (preferred): package settings → Trusted Publishers → GitHub Actions  
`owner: cervio-app` · `repo: n8n-nodes-cervio` · `workflow: publish.yml` · allow `npm publish`  
Fallback: repo secret `NPM_TOKEN`.

Published package: [`@cervio/n8n-nodes-cervio`](https://www.npmjs.com/package/@cervio/n8n-nodes-cervio).

Legacy unscoped name (if still present):

```bash
npm deprecate n8n-nodes-cervio@"*" "Use @cervio/n8n-nodes-cervio instead"
```
