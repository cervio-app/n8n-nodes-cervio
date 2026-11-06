# Contributing

## Development

```bash
npm install
npm run build
npm test
npm run verify
npm run lint
```

Optional live smoke (copy `.env.example`):

```bash
export CERVIO_BASE_URL=https://YOUR_TENANT.cervio.app
export CERVIO_PAT=cpat_…
npm run smoke
npm run smoke:extended
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

## Versioning and tags

Keep these three equal for every release:

| Source | Example |
|--------|---------|
| `package.json` `version` | `0.2.1` |
| Annotated git tag | `v0.2.1` |
| npm `@cervio/n8n-nodes-cervio` | `0.2.1` |

- Never move or delete a published `v*` tag
- Pushing a `v*.*.*` tag runs [.github/workflows/publish.yml](./.github/workflows/publish.yml) (npm publish with provenance). If that version is already on npm, the job skips publish.

### Cut a release

```bash
# from a clean main, after features are merged
npm version patch   # or minor / major — bumps package.json, commits, tags vX.Y.Z
git push origin main --follow-tags
gh release create "v$(node -p "require('./package.json').version")" --generate-notes
```

npm Trusted Publishing (preferred): package settings → Trusted Publishers → GitHub Actions  
`owner: cervio-app` · `repo: n8n-nodes-cervio` · `workflow: publish.yml`  
Fallback: repo secret `NPM_TOKEN`.

Published package: [`@cervio/n8n-nodes-cervio`](https://www.npmjs.com/package/@cervio/n8n-nodes-cervio).

Legacy unscoped name (if still present):

```bash
npm deprecate n8n-nodes-cervio@"*" "Use @cervio/n8n-nodes-cervio instead"
```
