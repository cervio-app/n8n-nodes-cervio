# End-to-end tests

`npm run e2e` tests the node the way users run it: it packs the package, installs it as a
community package in a local n8n (Docker), and runs real n8n workflows against a Cervio
tenant. Every result is also checked through Cervio's REST API, independently of the node.

Use a **test tenant**: the run creates data there and keeps it, so you can inspect it.

## Requirements

- Docker, Node.js 20+
- A Cervio Personal Access Token of a system administrator, with the scopes
  `records:read`, `records:write`, `admin:read`, `admin:write`, `me:write`

## Run

```bash
export CERVIO_E2E_BASE_URL=https://<test-tenant>
export CERVIO_E2E_TOKEN=cpat_...
npm run e2e
```

| Variable                             | Default                 | Notes                                                                   |
| ------------------------------------ | ----------------------- | ----------------------------------------------------------------------- |
| `CERVIO_E2E_BASE_URL`                | –                       | Required. Tenant address.                                               |
| `CERVIO_E2E_TOKEN`                   | –                       | Required. Personal Access Token (see above).                            |
| `N8N_E2E_IMAGE`                      | image in `compose.yaml` | n8n version to test with.                                               |
| `N8N_E2E_PORT`                       | `5678`                  | Local n8n port.                                                         |
| `N8N_E2E_CONTAINER`                  | `n8n-cervio-e2e`        | Container name; its volume is recreated each run.                       |
| `N8N_E2E_DOCKER_NETWORK`             | `bridge`                | `host` when n8n must reach a proxy or a tenant on localhost.            |
| `NODE_EXTRA_CA_CERTS`, `HTTPS_PROXY` | –                       | Passed to n8n when set. Behind a proxy also set `NODE_USE_ENV_PROXY=1`. |

At the end the run prints a table and writes `e2e-report/<run id>.md` (and `.json`). The local
n8n keeps running at the printed address, with the test workflows in it; `--stop` stops it.

Remove a run's data from the tenant:

```bash
npm run e2e -- --cleanup <run id>
```

Cervio keeps entities that once had records, so cleanup deletes the records and deactivates
the entities and the workflow.

## Test data

All named after the run id (`n8n e2e <run id> …`):

- **Companies**: Acme, Beta, Gamma.
- **People**: name, email (unique, any case), status, company (relation to Companies),
  documents enabled, explicit document permissions for the token owner.
- **Projects** and **Assignments**: N:M between People and Projects, with link fields
  year (required) and hours.
- A Cervio **workflow** on People: manual start → status = `data.reason`.
- A Word **template** on People with `{{name}}`.

## Cases

| ID      | What is checked                                                                              | What to look at in Cervio          |
| ------- | -------------------------------------------------------------------------------------------- | ---------------------------------- |
| A1      | Test credential with a valid token                                                           | Token "last used" updated          |
| A2      | Wrong token: clear message                                                                   | –                                  |
| A3      | Cloud metadata address is never called                                                       | –                                  |
| A4      | IPv6 form of the metadata address is blocked                                                 | –                                  |
| B1–B6   | Editor dropdowns: entities, forms, views, relation fields (no N:M), N:M fields, match fields | –                                  |
| B7      | Workflow dropdown lists the test workflow                                                    | Workflow "Set status"              |
| B8      | Create fields: Company offered as a list, N:M field hidden                                   | –                                  |
| B9      | Link fields: Year (required) and Hours, without the record keys                              | –                                  |
| C1      | Create from 3 input items: 3 records, each paired with its item                              | People Ada, Bruno, Carla           |
| C2      | Get returns the saved fields                                                                 | –                                  |
| C3      | Update changes only the fields set                                                           | Names end with "(updated)"         |
| C4      | Update with an old "Only If Unchanged Since" is refused                                      | Ada not renamed                    |
| C5      | Validate Draft does not save                                                                 | No "Draft" person                  |
| C6      | Create or Update: creates, then updates the same record                                      | One Dave "(upserted)"              |
| C7      | Duplicate email in another case: refused with the rule message                               | No "Copy" person                   |
| C8–C9   | List View: first page with cursor and total; all pages                                       | –                                  |
| C10     | List with a filter                                                                           | –                                  |
| C11     | Search finds a relation candidate by text                                                    | –                                  |
| C12     | Resolve Key: emails to record IDs                                                            | –                                  |
| C13     | A record ID that is not a UUID is refused before any call                                    | –                                  |
| C14–C15 | Send to Me, Notify Users                                                                     | Two notifications in the bell      |
| C16     | Delete                                                                                       | Carla gone                         |
| D1      | Link with link fields                                                                        | Ada → Projects                     |
| D2      | Linking the same project again adds a second row                                             | –                                  |
| D3      | Missing required link field: Cervio's message                                                | –                                  |
| D4      | Unlink removes only that row                                                                 | One row left, year 2027            |
| D5      | Unlink again: `deleted: 0`, safe to retry                                                    | –                                  |
| E1      | List documents of a record without any: no items                                             | –                                  |
| E2–E3   | Upload a file, list it                                                                       | Ada → Documents: the upload        |
| E4      | Open: the download link returns the same content                                             | –                                  |
| E5      | Generate from Template                                                                       | Ada → Documents: generated "Badge" |
| F1–F2   | Start a Cervio workflow with data; the workflow writes it into the record                    | Bruno → Status                     |
| F3      | Get Run Status                                                                               | Workflow runs                      |
