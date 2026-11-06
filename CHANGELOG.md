# Changelog

All notable changes to [`@cervio/n8n-nodes-cervio`](https://www.npmjs.com/package/@cervio/n8n-nodes-cervio) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.5] - 2026-11-06

### Changed

- **Breaking:** node `typeVersion` is **2 only** (Resource + Operation). Flat typeVersion 1 UI removed; re-open / upgrade existing Cervio nodes in the editor if needed.
- Public contact / package `author.email` → `dev@cervio.app`.
- `package.json` `homepage` → `https://cervio.app`; credential / codex docs URL → README `#installation`.
- README: CI + made-by badges, Website / Issues / Changelog links; Contributor Covenant `CODE_OF_CONDUCT.md`.

## [0.2.4] - 2026-11-06

### Added

- Node `typeVersion` **1** (flat operations, existing workflows) and **2** (Resource + Operation).
- `assertSafeCervioBaseUrl` — reject link-local / cloud-metadata Base URLs.
- Community invariant verifier (`scripts/verify-community-invariants.mjs`) for pairedItem / no open JSON / resource grouping (covers what ESLint cannot see after the module split).
- Coverage gates on focused modules; CI `eslint --max-warnings 0`.
- Domain split: `description/{operations,sharedFields}`, `execute/{batchOps,records,documents,relations,workflows}`.
- Expanded unit tests (HTTP mocks, create, base URL, resource map).

### Changed

- `workflowData` is a typed fixedCollection (name/value), not free-form JSON.
- Compose / Dockerfile pin `n8nio/n8n:2.47.2`; Dockerfile uses `N8N_CUSTOM_EXTENSIONS` only.

## [0.2.3] - 2026-11-06

### Added

- Resource selector (`record` / `relation` / `document` / `workflow`) for n8n community lint / verified-path alignment.
- ESLint with `@n8n/eslint-plugin-community-nodes`; Dependabot; `SECURITY.md`; `CHANGELOG.md`; `CODEOWNERS`.
- GitHub Release creation from `publish.yml` after npm publish.
- Unit tests for `flattenRecordRow` and execute `get`.
- `engines.node >= 20`; pin `n8n-workflow` as compile-time devDependency.

### Changed

- Split `Cervio.node.ts` into `description/`, `methods/`, and `execute/` modules (operation values unchanged).
- English-only UI/helper strings (form role labels, update empty-fields error).
- npm Trusted Publishing with provenance attestations (public source repo).

### Fixed

- `pairedItem` on batch list/search outputs; wrap unexpected execute errors in `NodeOperationError`.

## [0.2.2] - 2026-11-06

### Added

- Trusted Publishing (OIDC) via `.github/workflows/publish.yml` on `v*.*.*` tags.
- English UI strings and demo GIF in README.

### Fixed

- Pack exclude for `__tests__` JSON fixtures via `copy-icons` skip.

## [0.2.1] - 2026-11-05

### Changed

- Scoped package `@cervio/n8n-nodes-cervio`; unscoped name deprecated.

[Unreleased]: https://github.com/cervio-app/n8n-nodes-cervio/compare/v0.2.5...HEAD
[0.2.5]: https://github.com/cervio-app/n8n-nodes-cervio/releases/tag/v0.2.5
[0.2.4]: https://github.com/cervio-app/n8n-nodes-cervio/releases/tag/v0.2.4
[0.2.3]: https://github.com/cervio-app/n8n-nodes-cervio/releases/tag/v0.2.3
[0.2.2]: https://github.com/cervio-app/n8n-nodes-cervio/releases/tag/v0.2.2
[0.2.1]: https://github.com/cervio-app/n8n-nodes-cervio/releases/tag/v0.2.1
