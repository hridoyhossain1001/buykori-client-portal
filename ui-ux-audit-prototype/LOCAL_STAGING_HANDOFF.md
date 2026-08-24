# Local Staging Handoff

Status: prepared locally; no remote deployment performed.

## Current artifact

- Build command: `npm run build`
- `dist/server.cjs` SHA-256: `FD13E4388F5F6F269C9B09A710284E3DA11620C3270EFE94C0B9B005B8186132`
- Prototype scope: `client-portal/ui-ux-audit-prototype/`
- AI Ads beta scope: server-authorized Client 47 only
- Provider writes: disabled; adapter contract is GET-only

## External blockers

- `STAGING_SSH_HOST` is still the placeholder `staging.example.com`.
- No staging deploy user/known-host configuration is present.
- No authenticated non-47 staging session is available.
- No separate authenticated Client 47 staging session is available for the prototype origin.
- No staging rollback artifact hash has been supplied.

## Required next staging evidence

1. Deploy the prototype bundle to an isolated staging target with the existing backend/BFF as same-origin API.
2. Run authenticated non-47 and Client 47 GET-only smoke checks.
3. Record the previous bundle hash, restore it, and rerun portal health plus one authenticated read-only page.
4. Obtain explicit approval for any staging apply. Production remains out of scope.
