# Prototype Replacement Staging Runbook

This runbook applies only to a staging environment. It does not authorize deployment, migration, provider writes, or production UI replacement.

## Preconditions

- Build the client portal locally with `npm run build`.
- Keep the current production portal bundle available as the rollback artifact.
- Configure the staging backend/BFF as the same-origin API for the prototype bundle.
- Keep `AI_ADS_GLOBAL_KILL_SWITCH=true` and provider live writes disabled.
- Keep the server-side AI Ads allowlist restricted to Client 47.

## Read-only verification

1. Open the prototype with an authenticated non-47 staging account. Confirm every primary page loads and AI Ads shows the upgrade state.
2. Open the prototype with an authenticated Client 47 account. Confirm `/api/profile` returns `aiAdsEnabled: true` and AI Ads Overview, Connected Accounts, Campaigns, and Analytics render.
3. Confirm Orders, COD, Checkouts, Events, Delivery Logs, and Dashboard preserve server-owned IDs, totals, timestamps, pagination, and empty/error states.
4. Confirm browser query values such as `client=47` do not change access for a non-47 account.
5. Inspect the browser network log. Prototype requests must be GET-only; no approve, queue, OAuth, disconnect, account-select, or provider-write request is allowed.
6. Confirm provider credentials, tokens, raw payload secrets, and unredacted query parameters never appear in DOM, logs, or responses rendered by the prototype.

## Rollback rehearsal

1. Record the current prototype artifact hash and the existing portal artifact hash before staging.
2. Serve the prototype artifact in staging and capture the smoke report.
3. Restore the previous portal artifact without changing database schema, API routes, feature flags, or provider credentials.
4. Re-run the existing portal health check and one authenticated read-only page check.
5. Record both artifact hashes, the restore time, and the result. A rollback is incomplete if it requires a migration or provider-side change.

## Release gate

The prototype is not production-ready until authenticated Client 47 and non-47 staging checks pass, the rollback rehearsal succeeds, and a separate user approval authorizes the exact staging or production action.
