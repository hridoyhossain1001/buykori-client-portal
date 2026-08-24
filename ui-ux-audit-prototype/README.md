# Buykori Client UI/UX Audit Prototype

This folder is an isolated presentation prototype for the full client portal. The Orders experience is the reference visual language; the prototype also covers Overview, COD review, Abandoned checkouts, Event activity, Delivery logs, Performance, Campaign tools, AI Ads, Setup, Setup Health, Settings, and Account.

- Layer: frontend presentation only
- Existing interface reuse: React and `lucide-react` from the client portal toolchain
- Tenant/credential boundary: sample fallback plus optional same-origin, authenticated, tenant-scoped GET adapters; browser/query values never authorize a tenant or Client 47
- Policy/risk: read-only adapter paths only; no approval, queue, OAuth, disconnect, provider write, or execution path
- Tests: prototype contract/security tests, authenticated disposable-database integration, TypeScript lint, production build, and local HTTP smoke
- Migration impact: none
- Release/rollback impact: not part of production; delete this folder to remove it

Open through the existing local client portal dev server:

`http://127.0.0.1:3000/ui-ux-audit-prototype/`

The full section-by-section audit and add/remove recommendations are in `FULL_PORTAL_AUDIT.md`.

Read-only adapter verification:

`npx tsx --test ui-ux-audit-prototype/*.test.ts`

Latest local result: **26/26 passed**.

The staging smoke consumes redacted production-shaped snapshots only. It performs no HTTP mutation and needs no credential. A remote staging URL/session is still required for an authenticated HTTP GET smoke against a deployed environment.

Local authenticated API verification is covered by `tests/test_client_portal_readonly_integration.py`. It uses a disposable local database and encrypted portal session cookie to verify read-only tenant-scoped pagination contracts; it does not call any remote environment or provider.

AI Ads beta gate verification:

- The real backend includes `aiAdsEnabled` in `/api/profile`, derived from the server-side beta allowlist (`deploy/ai_ads_beta_allowlist.json`, currently Client 47).
- The local mock server intentionally does not impersonate Client 47, so the local preview shows the upgrade state even when `client=47` is present in the URL.
- Query parameters never grant access. A Client 47 authenticated backend session is required before the prototype fetches AI Ads read endpoints.

The staging replacement and rollback gates are documented in `STAGING_REPLACEMENT_RUNBOOK.md`. No staging or production action is implied by this prototype folder.
