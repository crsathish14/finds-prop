# Features

Read `docs/engineering/frontend.md` first. One feature = one folder: components, queries, service, actions, schemas, types, constants, hooks, tests and one index file. Use `docs/engineering/playbooks/new-slice.md` for a new capability.

1. Other modules import only your index file. Never deep-import another feature. (R-FE-03)
2. The schemas file is Zod only, no framework imports. One schema per input, used by the client resolver and the server action. Types come from `z.infer`. (R-BE-05, R-FE-10)
3. Queries: `import 'server-only'`, explicit columns, rows mapped to view models, `publicAnon` for cacheable public reads or `server` for user reads. Service: rules and writes, RPC for multi-step. Actions: only `defineAction(...)` exports. (R-BE-01, R-BE-06)
4. Route files in `src/app/` only compose. No Supabase calls or rules there. (R-FE-04)
5. Client islands are `*.client.tsx` leaves. They never import `src/server/`, queries or service files. Pass ids and small view models across the boundary, never raw rows. (R-FE-01, R-FE-02)
6. TanStack Query only in islands that need client caching or optimistic updates. Never for search results or detail pages. (R-FE-13)
7. Filters, sort, pagination and tabs live in the URL. One schema parses `searchParams`; defaults are omitted; invalid values are dropped. (R-FE-11)
8. Forms keep typed values on failure, focus the first error, disable submit while pending, and carry an idempotency key when the create is costly. (R-FE-10)
9. Implement every designed state: loading, empty, no matches, error, rate limited, not found, auth required. (R-FE-09)
10. `FLAG_AI_SEARCH`, `FLAG_MAP_VIEW`, `FLAG_PG_LISTINGS` default off; features behind them are absent from navigation when off. (R-FE-17)
11. Tests for the slice follow `docs/engineering/testing.md`.
