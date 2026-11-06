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

- SemVer in `package.json`
- Annotated git tags: `vX.Y.Z` (same number as the package)
- Tag only for a release; never move or delete a published `v*` tag

### Cut a release

```bash
# bump package.json → commit
git commit -am "chore(release): v0.3.0"
git tag -a v0.3.0 -m "v0.3.0"
git push origin main --follow-tags
gh release create v0.3.0 --generate-notes

# npm: after Trusted Publishing is set on npmjs.com for this repo,
# uncomment push.tags in .github/workflows/publish.yml
# or run Actions → Publish → workflow_dispatch with tag v0.3.0
```
