# n8n-nodes-cervio

Community node for [n8n](https://n8n.io/) that talks to a [Cervio](https://cervio.app) tenant over the public REST API (`/api/v1`).

One node (**Cervio**) + one credential (**Cervio API**). Field lists come from the form write-schema (resource mapper), not free-form JSON. Marked `usableAsTool: true` for n8n AI Agent tools.

| | |
|--|--|
| Package | `n8n-nodes-cervio` |
| Version | see `package.json` / [Releases](https://github.com/cervio-app/n8n-nodes-cervio/releases) |
| License | [MIT](./LICENSE.md) |

## Quick start

1. Create a PAT in Cervio **Admin → API** (see [Permissions](#permissions)).
2. In n8n, add credential **Cervio API**:
   - **Base URL** = tenant host only, e.g. `https://acme.cervio.app` (required; no default)
   - **Personal Access Token** = `cpat_…`
3. Drop a **Cervio** node and pick an operation.

### Install (local / custom extensions)

```bash
git clone https://github.com/cervio-app/n8n-nodes-cervio.git
cd n8n-nodes-cervio
npm install && npm run build
npm link

mkdir -p ~/.n8n/custom && cd ~/.n8n/custom
npm link n8n-nodes-cervio
```

Restart n8n. Or run a disposable n8n against this folder:

```bash
npm run build
docker compose up
# → http://localhost:5678  (N8N_CUSTOM_EXTENSIONS mounts this repo)
```

## Operations

| Group | Operation (`value`) | API (summary) | Typical scopes |
|-------|---------------------|---------------|----------------|
| Records | `create` | `POST …/entities/{id}/records` | `records:write` |
| | `update` | `PATCH …/records/{id}` (+ optional `multi_value_modes`) | `records:write` |
| | `get` | `GET …/records/{id}` | `records:read` |
| | `delete` | `DELETE …/records/{id}` (soft) | `records:write` |
| | `upsert` | `POST …/records/upsert` (`match_field`) | `records:write` |
| | `validateDraft` | `POST …/forms/{name}/validate-draft` | `records:write`¹ |
| | `listView` | `GET …/views/{id}/records` (cursor pages) | `records:read` |
| | `listRecords` | `GET …/entities/{id}/records` (`filter[f]=eq.x`, **admin**) | `records:read` + `system_admin` |
| Relations | `searchRelation` | `GET …/relation-options?q=&limit=` | `records:read` |
| | `resolveRelation` | `POST …/resolve` | `records:read` |
| | `linkRecords` / `unlinkRecords` | `POST`/`DELETE …/fields/{through}/links` | `records:write` |
| Documents | `listDocuments` | `GET …/documents` | `records:read` |
| | `uploadDocument` | `POST …/documents` (multipart / binary) | `records:write` |
| | `openDocument` | `GET …/documents/{id}/open` → `signed_url` | `records:read` |
| | `generateDocument` | `POST …/documents/generate` | `admin:write` + `system_admin` |
| Workflows | `startWorkflow` | `POST …/workflows/{id}/runs` | `records:write` + trigger ACL |
| | `getWorkflowRun` | `GET …/admin/workflows/{id}/runs/{runId}` | `admin:read` + `system_admin` |

¹ Route uses the write-scope guard; dry-run does not persist.

**Notes**

- Create / Update / Upsert / Validate draft: pick **Entity** → **Form**, then the resource mapper.
- N:M **through** fields are not on the mapper — use **Link / Unlink** (or Create on the junction entity).
- Relation dropdowns are capped (~50); use **Search relation** for larger sets.
- List view defaults: options = slugs, relations = uuids (ready for Update).
- Generate document: paste a mapped **template UUID** (no public template catalog in v1 yet).

## Permissions

There is **no n8n-specific ACL** in Cervio. The node is a REST client; Cervio applies **two layers**. Both must allow the call.

```text
n8n  ──Bearer cpat_…──►  1) PAT scopes (Admin → API)
                              │  fail → 401 / scope error
                              ▼
                         2) User who owns the PAT (same ACL as UI)
                              │  fail → 403 / 404 / empty / validation
```

### Layer 1 — Token scopes

| Scope | Opens (in this node) |
|-------|----------------------|
| `records:read` | Get, List view/records, Search/Resolve relation, List/Open documents |
| `records:write` | Create, Update, Delete, Upsert, Validate draft, Upload, Link/Unlink, Start workflow |
| `admin:read` | Form / view / workflow **dropdowns**, Get workflow run |
| `admin:write` | Generate document from template |

`*:write` implies the matching `*:read`. Scopes alone do **not** grant row access or `can_create`.

### Layer 2 — User behind the PAT

The PAT impersonates its owner. Entity permissions, record policies, field denials, form/view assignments, document capabilities, and manual-workflow trigger roles still apply — same as the UI.

Example: PAT has `records:write` but the user has no `can_create` on the entity → **Create fails**.

| Setup | PAT owner | Scopes |
|-------|-----------|--------|
| Full guided UX (all pickers, generate, run status, List records) | `system_admin` | `admin:read`, `admin:write`, `records:read`, `records:write` |
| Narrow sync via assigned views/forms | Service user with that ACL | `records:read` / `records:write` only; prefer **List view**; paste ids if you skip admin pickers |

## Repository layout

```text
credentials/          Cervio API credential + icons
nodes/Cervio/         Node implementation, helpers, icons, unit tests
  __tests__/          Vitest (write-schema → resource mapper)
scripts/              build helpers + live smoke (optional)
.github/workflows/    CI + npm publish (dispatch until Trusted Publishing)
compose.yaml          Local n8n with this package mounted
Dockerfile            Optional image that bakes the node into n8n
types/                Ambient stubs for n8n-workflow (compile without native deps)
```

Published npm package contents: `dist/` only (`package.json` → `files`).

## Development

```bash
npm install
npm run build    # tsc + copy icons
npm test         # unit tests
npm run verify   # load compiled node + credential offline
npm run lint     # tsc --noEmit
```

Conventions, SemVer tags (`vX.Y.Z`), and npm publish: [CONTRIBUTING.md](./CONTRIBUTING.md).

### Live smoke (optional)

Against a real tenant (copy [`.env.example`](./.env.example)):

```bash
export CERVIO_BASE_URL=https://YOUR_TENANT.cervio.app
export CERVIO_PAT=cpat_…
npm run smoke            # create / list view / update
npm run smoke:extended   # get, upsert, resolve, upload/open, N:M link, workflows
npm run smoke:relations  # heavier relation/multivalue lab fixtures
```

| Script | Notes |
|--------|--------|
| `smoke:extended` | Requires Wave B routes on the tenant. Unlink needs the PAT junction-listing fix on Cervio. Generate skips without a real template id. Start workflow skips without manual-trigger ACL. |
| `CERVIO_SMOKE_KEEP=1` | Leave created records |
| `CERVIO_SMOKE_DELETE_ID` | Also soft-delete another disposable id |

## Known limits

- **List records** without a view is admin-only — partners should use **List view**
- Nested child create = two Creates (parent, then child with FK)
- Lookup-only view columns are labels, not UUIDs — use Search relation / Get for ids
- List view “all pages”: max 10 × 500 rows

## References

- [Cervio](https://cervio.app)
- Tenant OpenAPI: `public/openapi/v1.yaml` in the Cervio app repo
- [n8n community nodes](https://docs.n8n.io/integrations/community-nodes/)
- [Building community nodes](https://docs.n8n.io/integrations/community-nodes/building-community-nodes/)
