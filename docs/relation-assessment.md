# Relation / multivalue assessment (n8n Cervio node)

Evidence from `npm run smoke:relations` (2026-11-05) plus follow-up node changes.

## Implemented after assessment

| Area | Change |
|------|--------|
| List→Update | Defaults `options=slugs`, `relations=uuids`; `coerceWriteValue` / `pickCompiledFieldValues` unwrap `{id,label}` |
| Mapper | Dedup repeated field names (e.g. `sede_id`×3); clearer relation / multi_select help |
| Tendine | Cap **50** kept for UX; new op **Cerca relazione** → `relation-options?q=&limit=` (max 100) |
| Multi_select | UUID[] (JSON / comma-separated OK); Update Advanced → `multi_value_modes` add/replace/remove |
| Through N:M | Still omitted; node description + README point to junction Create / MCP |

## Still missing / deferred

| Prio | Item | Notes |
|------|------|--------|
| P1 | Nested child create | Still two Creates (parent then child with FK) |
| P1 | REST `link_records` | Platform gap — not inventable in the community node alone |
| P2 | Non-admin form/view list | Still `/api/v1/admin/…` loaders |
| P1 | Lookup-only views | List cannot invent UUID columns the view does not expose |

## How to verify

```bash
cd integrations/n8n-nodes-cervio
npm test
npm run verify
CERVIO_PAT=cpat_… npm run smoke:relations
```
