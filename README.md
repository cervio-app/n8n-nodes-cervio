# n8n Cervio node

Community node for [n8n](https://n8n.io/) that connects workflows to a [Cervio](https://cervio.app) tenant.

The package ships a single node — **Cervio** — with guided operations over the public REST API (`/api/v1`). Entity, form, view, and workflow pickers are dropdowns where the API exposes lists; create/update/validate/upsert field lists come from the form write-schema.

All operations share the same [`Cervio API`](./credentials/CervioApi.credentials.ts) credential.

> The node is marked `usableAsTool: true`, so operations can be wired into an n8n AI Agent as tools.

## Operations

### Create record

Create a record through an assigned form mask.

- Pick **Entity** → **Form**
- Fill **Fields** via the resource mapper (Add all fields). Computed / read-only / N:M through fields are omitted
- `POST /api/v1/entities/{entityId}/records` with `{ form_name, data }`
- Output: `{ id }`
- Scopes: `records:write`

### Update record

Partial update through the same form mask (PATCH merge).

- **Record ID** from List view / Get record (`{{ $json.id }}`)
- Optional **Expected updated at** and **multi_value_modes** for multi-select relations
- `PATCH /api/v1/entities/{entityId}/records/{recordId}`
- Output: `{ id }`
- Scopes: `records:write`

### List view

Read records through an assigned list view (filters and columns on the view).

- **Entity** → **View**; first page or all pages (`next_cursor`, max 10 pages)
- Defaults: **options = slugs**, **relations = uuids**
- `GET /api/v1/views/{viewId}/records` (+ optional count)
- One item per record; `id` always present
- Scopes: `records:read`

### Search relation

Browse/search relation field candidates (`relation-options`, limit 1–100).

- Output: `{ id, label, field }` per candidate
- Scopes: `records:read`

### Get record

Read one record by id with field masking / ABAC applied.

- `GET /api/v1/entities/{entityId}/records/{recordId}`
- Output: flattened `{ id, …field values }` (from `record.data` when present)
- Scopes: `records:read`

### Delete record

Soft-delete a record.

- `DELETE /api/v1/entities/{entityId}/records/{recordId}`
- Output: `{ ok: true, id }`
- Scopes: `records:write`

### List records (entity)

Admin-only entity listing (non-admin callers must use List view).

- Filters: fixed collection → query `filter[field]=eq.value`
- **Limit** (1–500) and **offset**
- `GET /api/v1/entities/{entityId}/records`
- One item per record (flattened like Get)
- Requires **system_admin** (or impersonated admin PAT)
- Scopes: `records:read` + admin role

### Validate draft

Dry-run the form formula pipeline (defaults, computed, conditionals, validation).

- Same **Form** + **Fields** mapper as Create
- Optional existing **Record ID** under advanced options (`record_id` in API body)
- `POST /api/v1/entities/{entityId}/forms/{formName}/validate-draft`
- Output: `{ ok, resolved_data, field_state, errors, … }` (always HTTP 200 from API)
- Scopes: `records:read` (POST uses write-scope guard on route)

### Upsert record

Natural-key upsert (0 matches → create, 1 → update, >1 → error).

- **Match field** dropdown (scalar fields from write-schema)
- **Fields** mapper like Create
- `POST /api/v1/entities/{entityId}/records/upsert` with `{ form_name, match_field, data }`
- Output: `{ id, action }` (`created` | `updated`)
- Scopes: `records:write`

### List documents

Metadata for documents linked to a record.

- `GET /api/v1/entities/{entityId}/records/{recordId}/documents`
- One item per document (empty list → single `{ _empty: true, record_id }`)
- Scopes: `records:read`

### Upload document

Multipart upload (new document or new version if one is already linked).

- **Binary property** (default `data`) from the n8n item
- Optional **title** / **file name**
- `POST …/documents` (`file`, `file_name`, optional `title`)
- Output: `{ document_id, version_id, created }`
- Scopes: `records:write`

### Open document

Signed URL for the original file.

- **Document ID**
- `GET …/documents/{documentId}/open`
- Output: API payload (e.g. `signed_url`, expiry)
- Scopes: `records:read`

### Generate document from template

Render a mapped template onto the record (admin).

- **Template ID** as UUID string (no public template list in `/api/v1`; enter id manually)
- `POST …/documents/generate` with `{ template_id }`
- Scopes: **`admin:read`** + **`admin:write`** (system_admin)

### Link records / Unlink records

N:M through-field links (REST parity with MCP `link_records` / `unlink_records`).

- **Form** → **Through field** (N:M storage on mask)
- **Record ID** = near/from side; **Far record ID** = other side
- `POST` / `DELETE …/forms/{form}/fields/{field}/links` with `{ from_record_id, far_record_id }`
- Scopes: `records:write`

### Resolve relation (natural keys)

Resolve scalar match values to record UUIDs.

- **Match field**; **Values** as JSON array or comma-separated list
- Optional **field name** (resolve on relation target entity)
- `POST /api/v1/entities/{entityId}/resolve`
- One output item per result row in `results`
- Scopes: `records:read`

### Start workflow

Manual workflow run for a record (same ACL as UI “Avvia workflow”).

- **Workflow** dropdown (`GET /api/v1/admin/workflows` for picker)
- **Entity** hidden; **Record ID** as `entity_data_id`
- Optional JSON **payload**
- `POST /api/v1/workflows/{id}/runs`
- Output: `{ invocation_id }` (202)
- Scopes: `records:write`

### Get workflow run status

Poll invocation / instance status.

- **Workflow** + **Run ID** (`invocation_id` from Start workflow)
- `GET /api/v1/admin/workflows/{id}/runs/{runId}`
- Scopes: **`admin:read`** (system_admin)

## Prerequisites

1. **Node.js ≥ 20**
2. An **n8n** instance
3. Cervio **Personal Access Token** (`cpat_…`) from **Admin → API**
   - Typical scopes: `admin:read`, `admin:write`, `records:read`, `records:write`
   - **system_admin** user for admin pickers (forms, views, workflows, entity list records, generate document, workflow run status)
4. External API enabled for the organization

## Installation

### From source (development)

```bash
cd integrations/n8n-nodes-cervio   # or clone the published package root
npm install
npm run build
npm link

mkdir -p ~/.n8n/custom
cd ~/.n8n/custom
npm link n8n-nodes-cervio
```

Restart n8n. The **Cervio** node and **Cervio API** credential appear in the palette.

### Docker Compose

Mount or bake the built `dist/` (or `npm link` equivalent) into the n8n image’s custom extensions path (`N8N_CUSTOM_EXTENSIONS` / `~/.n8n/custom`), then restart.

## Development

```bash
npm install
npm run build
npm test
npm run verify
```

Live smoke:

```bash
CERVIO_BASE_URL=https://dev.cervio.app CERVIO_PAT=cpat_… npm run smoke
CERVIO_BASE_URL=… CERVIO_PAT=… npm run smoke:extended   # get, validate-draft, list, upsert, resolve, delete cleanup
CERVIO_BASE_URL=… CERVIO_PAT=… npm run smoke:relations
```

Set `CERVIO_SMOKE_KEEP=1` to leave the smoke record; `CERVIO_SMOKE_DELETE_ID` to also DELETE another disposable id.

## Scopes summary

| Area | Typical scopes | Notes |
|------|----------------|-------|
| Records CRUD, views, docs, links, upsert, resolve, start workflow | `records:read`, `records:write` | List entity records needs admin role |
| Form/view/workflow pickers, generate doc, workflow run status | `admin:read`, `admin:write` | system_admin user |

## Known limits

- **List records** without a view is admin-only; partners should use **List view**
- **Template ID** has no REST catalog in v0.2 — paste UUID from Admin
- Relation dropdown cap (~50); use **Search relation** for larger sets
- **List view** all-pages cap: 10 pages × 500 rows
- **Upsert / resolve / N:M links / generate document** need the Wave B `/api/v1` routes on the tenant app (not only the community node). Until that deploy lands, those ops return 404/405; `npm run smoke:extended` warns and continues.

## References

- [Cervio](https://cervio.app)
- OpenAPI: `public/openapi/v1.yaml` in the monorepo
- [n8n community nodes](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](./LICENSE.md)
