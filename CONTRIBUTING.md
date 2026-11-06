# Contributing

## Development

```bash
npm install
npm run build
npm test
npm run verify
npm run lint
```

Live smoke against a Cervio tenant (optional; copy `.env.example`):

```bash
export CERVIO_BASE_URL=https://YOUR_TENANT.cervio.app
export CERVIO_PAT=cpat_…
npm run smoke
npm run smoke:extended
```

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Use |
|--------|-----|
| `feat:` | New operation or user-visible capability |
| `fix:` | Bug fix |
| `docs:` | README / CONTRIBUTING only |
| `chore:` | Tooling, CI, deps, release bump |
| `test:` | Tests only |
| `refactor:` | Internal change, no behaviour change |

Examples: `feat: add upsert record operation`, `fix: coerce relation id on update`.

## Pull requests

1. Branch from `main`
2. Keep the node REST-only (`/api/v1`); do not call MCP/Edge from the package
3. CI must pass (`lint`, `build`, `test`, `verify`)
4. Update `README.md` when you add or change an operation

## Versioning and tags

- **SemVer** in `package.json` (`MAJOR.MINOR.PATCH`)
- **Git tags** are annotated and prefixed: `v0.2.0` (same number as `package.json`)
- Tag only for a release, not on every merge
- Prefer a [GitHub Release](https://docs.github.com/en/repositories/releasing-projects-on-github) on each tag

### Cut a release

```bash
# 1. Bump version in package.json
# 2. Commit
git add package.json package-lock.json README.md
git commit -m "chore(release): v0.3.0"

# 3. Annotated tag + push
git tag -a v0.3.0 -m "v0.3.0"
git push origin main --follow-tags

# 4. GitHub Release notes
gh release create v0.3.0 --generate-notes

# 5. npm (after Trusted Publishing is configured)
#    Actions → Publish → Run workflow → tag v0.3.0
#    Or uncomment push.tags in .github/workflows/publish.yml
```

Do not move or delete a published `v*` tag; ship a new version instead.
