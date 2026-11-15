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

1. Branch from `develop` and open the pull request against `develop`
2. Stay REST-only (`/api/v1`) — no MCP/Edge calls from this package (the e2e scripts use Cervio MCP only to build test data)
3. CI must pass (`lint`, `build`, `test`, `verify`)
4. Update `README.md` when operations change
5. Keep unit tests next to the node under `nodes/Cervio/__tests__/`
6. Update `CHANGELOG.md` `[Unreleased]` for user-facing changes

## Versioning and tags

Keep these three equal for every release:

| Source                         | Example  |
| ------------------------------ | -------- |
| `package.json` `version`       | `0.3.0`  |
| Annotated git tag              | `v0.3.0` |
| npm `@cervio/n8n-nodes-cervio` | `0.3.0`  |

- Never move or delete a published `v*` tag
- Pushing a `v*.*.*` tag runs [.github/workflows/publish.yml](./.github/workflows/publish.yml) (npm Trusted Publishing via OIDC + provenance, then GitHub Release). If that version is already on npm, the job skips publish and still ensures a GitHub Release exists.
- **Provenance:** enabled (`npm publish --provenance`). The GitHub source repository must stay **public**.

### Cut a release

`main` holds released code only; work lands on `develop` first.

1. On `develop`: move CHANGELOG `[Unreleased]` into a new version section and set `version` in `package.json` (and `package-lock.json`).
2. Run `npm run lint`, `npm run test:coverage`, `npm run verify` and, against a test tenant, `npm run e2e` ([docs/e2e.md](docs/e2e.md)).
3. Open the release pull request `develop` → `main` and merge it with a merge commit.
4. Tag the merge commit on `main` and push the tag:

```bash
git tag -a vX.Y.Z -m "vX.Y.Z" <merge commit on main>
git push origin vX.Y.Z
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

## End-to-end tests

`npm run e2e` runs the packed node in a local n8n against a Cervio test tenant. See [docs/e2e.md](docs/e2e.md).
