# Buykori Client Portal Full UI/UX Audit

This audit covers the client portal's primary navigation, settings subsections, AI Ads subsections, account surfaces, and the Orders design direction approved by the user.

## Recommended Information Architecture

| Group | Keep / add | Merge or remove |
|---|---|---|
| Operations | Overview, Orders, COD review, Abandoned checkouts | Keep Orders and Shipping as one workflow, but use Orders and Shipping views inside the page instead of two competing top-level concepts |
| Tracking | Event activity, Delivery logs, Setup health | Keep event inspection and provider delivery history separate; remove duplicate health summaries from unrelated pages |
| Growth | Performance, Campaign tools, AI Ads | Keep all three, but make Performance the reporting source, Campaign tools the implementation utility, and AI Ads the planning/proposal workspace |
| Administration | Setup guide, Settings, Account | Keep setup as onboarding, settings as configuration, account as identity/billing/security |

## Section Decisions

### Overview

Keep: platform health, event delivery trend, usage, action center, recent activity.

Add: a single “next best action” queue with direct links to the fixing surface; explicit date range and comparison state.

Remove: repeated health cards that only restate the same percentage; decorative usage gradients.

Risk: current dashboard can show contradictory signals such as 0% delivery beside healthy-looking platform rows. Every metric needs denominator, period, and source.

### Orders

Keep: order review, status changes, invoice, courier booking, bulk selection, detail view.

Add: saved views, product and location context, payment mode, risk, fulfillment state, courier tracking, right-side detail drawer, contextual bulk actions.

Remove: repeated per-row action buttons that compete with the recommended next action; duplicate page heading; generic “Book” labels without state.

Prototype update: the order drawer now exposes courier provider, tracking ID, and shipment state separately. Unbooked orders show a booking-prerequisite note covering enabled provider, credentials, pickup configuration, and recipient data. The live integration must return a consignment ID before moving an order to shipped; provider failures remain retryable and must retain the error code instead of showing a false success.

The isolated prototype at `http://127.0.0.1:3000/ui-ux-audit-prototype/` uses this direction as the reference visual language for every other section.

### COD Review

Keep: hold policy, confirm/skip decision, fraud context, order value.

Add: explicit explanation of when Purchase is emitted, review age, high-risk queue, and decision audit trail.

Remove: repeating explanatory copy on every order card; separate visual treatment for desktop and mobile that changes the decision model.

Live-contract correction: the production deferred-event workflow supports restoring a skipped order. The prototype therefore no longer describes Skip as permanently destructive. It now keeps skipped Purchase events unsent, exposes a restore action in Recent decisions, and treats Confirm as final only after provider delivery is known. The live implementation must populate this trail from tenant-scoped audit data and show partial/failed provider delivery rather than assuming a click succeeded.

### Abandoned Checkouts

Keep: active/contacted/recovered states, customer and cart context, recovery action.

Add: recovery age, source, last contact, and a clear recovery outcome.

Remove: “incomplete” and “abandoned” terminology appearing together; choose one user-facing label and use it consistently.

Prototype update: recovery status now separates `Active`, `Contacted`, `Ignored`, and `Recovered`. Recovered is no longer a free status choice: it is shown after the draft order returns an order ID and sync state. Create order includes an idempotency note keyed by checkout ID, while Ignore requires confirmation and remains undoable. Live integration must return the checkout-to-order correlation, sync result, and duplicate/idempotency outcome.

Checkout field contract correction: the queue and recovery drawer now label the API timestamp as `Last activity`, treat the returned location string as an address rather than claiming a dedicated city field, and do not invent a `Last contact` timestamp. Exact contact history remains unavailable until the backend exposes an authoritative field.

### Event Activity

Keep: destination filters, event type, status, timestamp, event detail.

Add: stable filter bar, failure reason, retry eligibility, event key copy, side detail panel.

Remove: JSON export as a primary action; keep it under a secondary menu.

Prototype update: event rows now carry an optional delivery request ID, and the failed Purchase is correlated to `req_19204`, the same request shown in Delivery logs. Detail panels show the event/request relationship, explicit HTTP result, retry state, and sanitized failure reason. Live APIs must preserve this correlation instead of joining records by timestamp or array position.

### Delivery Logs

Keep: provider health, request status, retry count, latency, provider request ID.

Add: grouping by provider and result, a clear failed-only view, retry policy explanation.

Remove: raw endpoint URLs from the primary scan path; expose them in the detail panel.

Prototype update: the failed Meta request now carries the source event ID (`evt_8f2a...923`) so operators can move from provider failure back to the event context. Delivery health labels remain denominator-first (`accepted / requests`) and retry state is separate from HTTP response state.

### Performance

Keep: revenue, spend, ROAS, customer journey, data-quality checks.

Add: denominator-first labels, date comparison, “Fix first” blockers, source confidence.

Remove: metrics that cannot be reconciled with delivery/event totals; never show 0% delivery without explaining the data source.

### Campaign Tools

Keep: URL builder and event tester.

Add: saved naming convention, preview before copy, sandbox/live boundary, test-result history.

Remove: long explanatory paragraphs below forms; move guidance into a compact help drawer.

### AI Ads

Keep: Overview, Connected accounts, Campaigns, Analytics, Chat/workspace.

Add: proposal status, exact change, policy version, expiry, approval history, account scope, and read-only/live-write state.

Remove: any campaign view that fails into a generic error page; unsupported capability must render a deliberate empty/disabled state.

### Setup Guide

Keep: progress, required steps, WordPress path, test event.

Add: resume-from-last-step, automatic verification status, clear prerequisites, and next action.

Remove: “Coming soon” tabs from the primary setup flow; place future platform support in a roadmap or disabled menu item.

### Setup Health

Keep: score, critical/warning distinction, issue detail, fix path.

Add: issue age, affected destination, example event key, mark-fixed confirmation, and recheck state.

Remove: generic “Mark fixed” without verification; a resolved state should be evidence-based.

### Settings

Keep: all existing capabilities, but group them by task.

Recommended sections:

- Store connection: domain, WordPress plugin, heartbeat.
- Tracking & events: destinations, event routing, custom events, COD timing.
- Ad accounts: read-only reporting connections.
- Courier partners: credentials, webhook, booking defaults.
- Alerts & notifications: Telegram, email, operational preferences.

Remove: the current long page where every settings group is rendered together and hidden with CSS. It creates excess scanning and duplicate context.

### Account

Keep: profile, password, two-step verification, sessions, billing, deletion.

Add: clear separation between identity, plan/billing, and irreversible actions.

Remove: danger-zone controls from the default profile viewport.

## Shared Design System

- Quiet light background, white operational panels, dark graphite text, one restrained green action color.
- Semantic status colors: green for healthy, amber for review, red for blocked/failed, blue for informational state.
- One page heading per route; global topbar uses breadcrumb context only.
- Tables for comparison and queues; detail drawers for secondary context.
- Cards only for genuinely framed tools or repeated records. Use bands and dividers for summaries.
- Stable desktop widths and mobile cards with no horizontal page overflow.
- Use icon-only buttons only for familiar actions and provide accessible labels.
- Use skeletons that preserve layout instead of bare `Loading...` text.

## Prototype Boundary

The prototype is static sample data in `portal.tsx`. It does not call the API, access credentials, mutate provider state, change policy, create migrations, or alter production routes. It is suitable for visual review only.

### Integration readiness contract matrix

The prototype now labels the source boundary and sample freshness on the operational pages. Before replacing the live UI, each surface must map to a tenant-scoped read model and expose the same states shown in the prototype:

| Surface | Required live read model | Correlation / idempotency key | Required UI states |
|---|---|---|---|
| Orders | order ledger plus courier snapshot | order ID; consignment ID after booking | loading skeleton, empty filtered view, permission denied, stale courier data, retryable booking failure |
| Incomplete checkouts | checkout ledger plus order-sync result | checkout ID as one-order idempotency key | loading, no active queue, duplicate recovery response, sync pending/failed, undoable Ignore |
| Event activity | event ledger plus delivery request relation | event ID and delivery request ID | loading, empty filters, failed/retrying, partial destinations, sanitized failure detail |
| Delivery logs | provider request ledger | request ID and source event ID | provider-health partial failure, failed-only empty state, retry queued, permission denied, redacted endpoint detail |
| COD review | pending-event/deferred decision ledger | order ID plus decision audit ID | stale review warning, confirm/skip outcome, restore path, partial provider delivery, policy/tenant scope denial |

The live API must return the tenant scope from `ActorContext`, a server timestamp, pagination metadata, and an explicit `dataFreshness`/`lastSyncedAt` value. The client must not infer joins by array position or timestamps, and must not treat an optimistic button click as provider success. Unsupported or unavailable data should render `Not available` or a retryable state rather than a zero.

Pagination is also a data-integrity boundary: the prototype's bounded sample pages now say "at least" when no authoritative total/has-more metadata is available. A replacement must not present the first N orders, checkouts, events, or delivery requests as a complete history; it must preserve server totals, has-more state, and filtered-page semantics.

### Final prototype QA evidence

- Route render check passed for Overview, Orders, COD review, Incomplete checkouts, Event activity, Delivery logs, Ad insights, Settings, and Account.
- No horizontal overflow was detected at the default desktop viewport on any checked route.
- Incomplete checkout Ignore opens a confirmation dialog; Create order opens the recovery contract drawer; recovered rows expose the created order state.
- Event detail opens with Event ID and Delivery request correlation; retry transitions the failed row to `Retrying` without claiming provider success.
- Browser checks were performed against the local prototype server only. This does not authorize or imply production deployment.

### Security/data-isolation regression evidence

Focused backend contract tests passed: 20 tests covering signed mutation authorization, order visibility/tenant scope, browser audit idempotency, purchase intake, and attribution consistency; 12 tests covering auth observability, courier webhook verification, and credential rotation. These results support the adapter boundaries but do not authorize production deployment or live provider writes.

Delivery adapter safeguard: the prototype exposes `eventId`, `outboxId`, and retry eligibility only when the authenticated server response supplies those authoritative fields. The current `/api/api-logs` implementation does not yet expose the complete correlation/retry DTO, so the live adapter must not infer `outboxId` from the request-log ID or coerce retryability from status/retry count. Retry remains exclusively owned by `POST /api/outbox/{outbox_id}/retry`; unresolved or foreign outbox references render as unavailable.

### Full repository regression result

The initial full repository run found three migration-graph failures because the untracked client email step-up revision `c47e8f1a2b3c` was being counted as a production head. The graph governance now explicitly classifies that revision as undeployed/historical for the current release lineage; it was not stamped, merged, or executed. Focused graph and step-up tests pass, and the latest rerun completed with **1122 passed, 2 skipped**. This clears the local release-readiness test gate, but does not authorize production migration or deployment.

Local read-only adapter fixture coverage is available in `adapter-contract.test.ts`. It covers server-owned order/courier IDs, numeric checkout identity, event-to-delivery correlation, empty/error/stale/partial states, tenant mismatch rejection, redacted secret handling, fail-closed retry authority, and prevention of fabricated retry endpoints. Real-shaped redacted JSON snapshots cover the current Orders/COD/courier, incomplete-checkout/create-order, event/outbox, delivery-health, and delivery-history response casing.

The executable read-only staging adapter smoke in `staging-adapter-smoke.test.ts` validates the Orders, COD, Courier, Checkout, Events, API Logs, and Outbox pagination envelopes; cross-surface server-owned IDs; secret redaction; absence of request-body tenant authority; and absence of HTTP mutation code. Together with AI Ads access/read-only and pagination tests, the complete prototype suite passes **26/26**. No remote staging host or authenticated portal session was provided, so this is production-shaped local contract verification rather than a deployed-environment HTTP smoke.

`tests/test_client_portal_readonly_integration.py` adds a real local authenticated API harness using the encrypted `buykori_client_session` path and `TestClient(app)`. It verifies GET-only tenant isolation, filtered totals, page non-overlap, final-page metadata, server-owned IDs, API-log/outbox correlation, and unchanged database row counts across Orders, COD, Checkouts, Events, Courier, API Logs, and Outbox. The focused harness plus profile regression passes **13/13**. It is local test-database evidence only; a separately authorized remote authenticated staging GET smoke remains required.

### Replacement safety conclusion

The prototype is isolated from provider mutation paths: it uses sample fallbacks and optional same-origin authenticated GET adapters. It does not receive provider credentials and exposes no approval, queue, OAuth, disconnect, or provider-write adapter. Preview actions remain local-only. Replacing the live UI therefore does not inherently alter stored client records, orders, events, or provider state, provided deployment preserves these read-only boundaries.

This is not a 100% production-safety guarantee. A live replacement is safe only after the production components are wired to the existing tenant-scoped services without changing request shapes, identifiers, mutation boundaries, or authorization. Current evidence includes a clean full repository suite, focused pagination adapter tests, TypeScript lint, and a production frontend build. Read-only staging verification and explicit release approval are still required.

Required pre-release proof:

- API contract and response-shape compatibility tests for Orders, COD, Checkouts, Events, Delivery, and Settings.
- Tenant-isolation and permission tests for every read and mutation route.
- Read-only staging smoke test with production-like data snapshots, including order IDs, event IDs, checkout IDs, courier consignment IDs, and delivery request IDs.
- Mutation canary with live writes disabled, followed by an explicitly approved canary plan before any provider write is enabled.
- Rollback verification that restores the previous UI bundle without database or provider changes.

### Read-only contract reconciliation

Implementation handoff: see [`LIVE_REPLACEMENT_ADAPTER_SPEC.md`](LIVE_REPLACEMENT_ADAPTER_SPEC.md) for the endpoint, field-ownership, state, mutation, testing, and staging gates required before the prototype can replace the live UI.

Field-level handoff: see [`FIELD_MAPPING_MATRIX.md`](FIELD_MAPPING_MATRIX.md) for exact prototype-to-live fields, status normalization, formatting rules, mutation semantics, and the remaining data-contract blockers.

Pagination handoff: see [`PAGINATION_CONTRACT.md`](PAGINATION_CONTRACT.md). Authoritative backend metadata is now available locally, and the prototype shows visible controls for every primary operational list. The live adapter must bind those controls to server-returned `totalCount`/`hasMore` values instead of fixture-derived totals.

The live client currently exposes these canonical boundaries, which the replacement must preserve:

| Prototype workflow | Existing live boundary | Reconciliation result |
|---|---|---|
| Orders / COD | `/api/deferred`, `/api/v1/orders/workflow-statuses`, `/api/v1/orders/{orderId}/status` | IDs and workflow mutations are server-owned; UI must not synthesize status success. |
| Courier | `/api/courier/orders`, `/api/courier/send`, `/api/courier/cancel/{id}` | Provider order/tracking IDs and courier status come from the server; booking prerequisites remain required. |
| Incomplete checkouts | `/api/incomplete-checkouts`, `/api/incomplete-checkouts/{id}/status`, `/api/incomplete-checkouts/{id}/create-order` | Live item identity is numeric checkout ID; recovery payload is server-validated. Prototype IDs are illustrative and must be replaced by API IDs. |
| Event activity | `EventLogsView` grouped event/delivery records | Event IDs and delivery relations must remain authoritative; grouping must not be recreated from display timestamps. |
| Delivery logs | `/api/delivery/health` plus delivery-history read path | Health and history are separate reads; replacement must preserve independent loading/error states and redaction. |

Open release blocker: the prototype's static checkout sample uses IDs such as `CHK-1048`, while the live contract uses numeric `IncompleteCheckoutItem.id`. This is safe for visual review but cannot be copied into production as-is. The adapter must map the real numeric ID and returned `orderId`; no UI-generated checkout/order IDs are acceptable.

## Live Interaction Audit Findings

The current client portal was click-tested at desktop and mobile widths against the local demo server. These findings take priority over visual polish:

> **Scope note.** This section describes the **production portal** (`client-portal/src/`), not this prototype. Nothing here has been changed in the production code. Every item was re-tested against the prototype and the outcome is recorded in *"The Live Interaction findings, re-checked against the prototype"* below: one reproduced and is fixed, the rest either do not exist in this build or are deliberate, with the reason given.

### P0 / P1 Fix Before Redesign Adoption

- `/ai-ads/campaigns` crashes into the error boundary with `Cannot read properties of undefined (reading 'slice')` in `AIAdsView.tsx`. Render a safe empty state when campaign data is missing and add a regression test for an undefined campaign list.
- `/api-logs` can show a failed delivery-health alert while the history table still loads. Split provider health from history loading state and make the partial state explicit.
- API log rows expose full provider endpoint URLs, including a GA4 URL containing `api_secret=...`. Redact query parameters and credential-like values before rendering or exporting.
- Current Analytics shows contradictory metrics: 150 events, 93 delivered, but 0% success rate and 0 daily average. Define metric denominators and render `Not available` when the source cannot support a number.
- Campaign Tools prefill a demo email, phone, IP address, user agent, and a base URL that does not match the active store. Label sandbox values clearly, use neutral placeholders, and show a visible sandbox/live boundary before dispatch.
- Account Plan & Billing has stale renewal dates and contradictory entitlement limits (50K vs 500K events) while showing an active plan with no successful payment history. Treat plan entitlement and billing state as a blocking data integrity issue, not a styling issue.

### Desktop Workflow Findings

- Orders works end-to-end for search, filter, selection, status change, invoice, edit, and courier modal, but the row has too many simultaneous actions. Keep one primary action and move invoice/edit/status to the detail drawer or overflow menu.
- `Check Unavailable` fraud status has no reason, retry path, or explanation. Every unavailable result should say whether the provider timed out, the check was not configured, or data was insufficient.
- Bulk `Book order` can be disabled without explaining that courier setup/credentials are missing. Put the reason beside the disabled action and link to Courier settings.
- COD Confirm/Skip works, but confirmation impact is unclear. Say explicitly that Confirm sends Purchase events and Skip suppresses them; add age and risk reason.
- Incomplete checkout actions work, but Create order and Ignore draft deserve a preview/confirmation; status transitions need an undo or visible result.
- Event logs filters, export, live mode, view, and retry work. Failed rows hide remediation until a detail view; show a compact failure reason in the queue and reserve raw JSON for details/export.
- Settings deep links show bare `Loading...` before content and several deep links render combined Courier and Telegram surfaces. Use layout-preserving skeletons and route-specific section ownership.
- Setup Guide reports `0 of 4 required` while the WooCommerce path has six steps. Use one denominator and distinguish required from recommended steps; hide or clearly disable future platform tabs.
- Setup Health allows Mark Fixed/Dismiss without an evidence-based recheck. Add Re-scan and keep the issue open until verification succeeds.
- Broken logo/platform/instructional assets are visible across Orders, Dashboard, Ad Insights, and Settings, materially reducing trust.

### Mobile Workflow Findings

- At 390x844 and 360x800 there was no page-level horizontal overflow, but many controls are below a 44px touch target: COD actions 32px, Incomplete Checkout icons 28px, event filters 36px, analytics timeframe controls 33px.
- Orders cards expose checkbox, detail, book, invoice, edit, and status simultaneously. Keep Book courier as the primary action; move the rest into a detail sheet or More menu.
- COD should use `Confirm purchase` as the primary action and put Skip in a secondary menu. Settings should open in a sheet instead of pushing the queue down.
- Incomplete Checkout should show one full-width Contact/Create order action; Copy, Ignore, and Mark contacted belong in an overflow menu.
- Event detail sheet must lock background scroll, trap focus, and normalize errors. The current UI can render `Rejected · [object Object]`.
- Mobile navigation needs deterministic first-tap opening, `aria-expanded`, a labelled drawer, Escape/backdrop dismissal, and focus return.
- Fixed mobile support CTA can occlude save/bottom actions. Reserve safe-area space or move support into the More/help surface.
- Settings and Account duplicate their page heading in the topbar and body. Keep the breadcrumb in the topbar and one page heading in content.

## Prototype Sub-Page Condition Audit

Every page in the prototype was opened, and every sub-tab inside the eight tabbed pages, at 1280x900 and 375x812. This section records what was actually wrong in the prototype itself and what was changed. Scope is unchanged: `portal.tsx` and `portal.css`, static sample data, no API/auth/credential path.

Sub-pages covered: Ad insights (Summary, Ad results, Sales source, Customers), Campaign tools (URL builder, Event tester, Data preview), AI Ads (Overview, Connected accounts, Campaigns, Analytics, AI workspace), Settings (Store connection, Tracking & events, Ad accounts, Courier partners, Alerts & notifications), Account (Profile & security, Plan & billing, Danger zone).

### One page contradicting another

These are the findings that mattered most: two surfaces describing the same fact and disagreeing.

| Surfaces | What they disagreed about |
|---|---|
| Settings → Tracking & events vs COD review drawer | Settings stated the hold policy as two literals ("held for review", "Auto-confirm is currently off") while the drawer that changes it kept private state. Turning Auto-confirm on left Settings still saying off. |
| Setup guide vs Settings → Tracking & events | Setup guide certified "6 events enabled · PageView through Purchase" while the routing table it describes ends on Lead, so the range excluded the last row it counted. |
| Overview → platform rows vs Delivery logs | Overview dated the newest delivery per destination to the minute; the delivery table's newest rows were "1h ago"/"2h ago"/"3h ago", roughly an hour behind, with no filter to explain the gap. |
| Event activity vs Delivery logs vs Setup health | All three describe one Meta CAPI rejection. Event activity called it "69 min ago", Delivery logs "1h ago", the alert tray "38 min ago" — three numbers, no clock time to join on. |
| Settings → Courier partners, "Webhook" tile | Counted providers whose credentials were saved, not providers that had received a callback, so it read "2 callbacks verified" while three providers were configured and one had never called back. |
| Settings → Courier partners, "Latest booking" | A bare literal duplicating Steadfast's callback minute, with no shipment behind it. |
| Settings → Alerts, "Send test alert" | Queued an "Email test" whenever Telegram was unlinked, while the email channel one panel above is scoped to "billing receipts and security emails only" — a test down a channel that carries no alerts. |
| Campaign tools → Event tester | Prefilled `103.120.34.18`, the exact IP Account → Profile & security lists as the owner's current session, so a sandbox form replayed a real person's request. |

### Timestamp and unit integrity

- Store identity was typed out seven times (sidebar switcher, URL builder base, two Setup guide evidence lines, Store connection plugin card and domain field, Account workspace facts). The heartbeat appeared as "3 min ago", "3 minutes ago" and "Heartbeat received 3 min ago" — three phrasings of one relative value, all wrong the moment the tab sat open. Now one `storeConnection` record with one absolute stamp.
- One `age` field fed a column headed **Placed** on Orders and a column headed **Waiting** on COD review, holding five values in three formats: "12h ago", "12h ago", "Yesterday", "Yesterday", "Aug 17". Neither header was right about all its rows and the column could not be sorted. `age` is now the absolute placed-at stamp; COD review derives the wait from it against the same notional clock the heartbeat reports.
- Event activity computed row times as `27 + i * 14` minutes ago, so the queue read 27/41/55/69 min ago no matter how long the tab stayed open.
- "Last sync: 12 min ago · both accounts" on Settings → Ad accounts was a third copy of the ad-sync stamp, and the last one still relative.
- Ad insights printed one hardcoded `Aug 21, 2026 · 10:42` under all three destinations, so a Degraded and a Healthy destination claimed the same last delivery to the minute.
- Two values were frozen arithmetic, correct only while the notional today stays Aug 21: "Last changed Jul 24, 2026 · 28 days ago" and the alert "Next charge in 3 days".
- Account → Profile & security had one relative session stamp ("Last active 2 days ago") on a page where invoices, the trial end, the renewal date and the last sign-in are all absolute.

Every user-visible time in the prototype is now an absolute stamp, and the delivery table's newest row per destination matches Overview's per-destination Last sync exactly. Meta's Degraded badge finally has a visible cause: its most recent request is the rejection.

### Controls that did not do what they said

- Settings → Store connection: the domain field was an uncontrolled `defaultValue` holding a bare hostname while its own hint asked for "the canonical HTTPS domain", and Save flashed the same sentence whatever you typed. It is controlled now, seeded with the HTTPS address, and rejects a non-HTTPS value by explaining why.
- Settings → Alerts: two preference keys (`failures`, `weekly`) sat in state while their rows render no toggle, so two of four values could never change and were never read.
- Both supported alert preferences default to on, which reads as "alerts are working" while the only channel that carries them was never linked. The gap is now stated rather than implied.
- Four Settings toggles were `<button className="toggle">` with an `aria-label` and a visual `.on` class but no `aria-pressed`, so a screen reader heard "Toggle Meta CAPI, button" with no state.
- Orders' last column was an Ellipsis labelled "More actions for WC-9284" with no `onClick`, no `aria-haspopup`, and no menu anywhere in the file. The click fell through to `<tr onClick>` and opened the detail drawer, so the control promised a menu and delivered a drawer. It is now labelled *"Open details for WC-9284"* with a chevron — the shape Delivery logs already used for the same job — and calls `setDetail` itself instead of relying on the row underneath. The order-ID button beside it had the same silent bubble and now calls `setDetail` explicitly with `stopPropagation`.
- COD review's order-ID button was fully inert: it had no handler and, unlike Orders, no clickable row beneath it, so clicking the ID did nothing at all. It navigates to Orders now.
- AI Ads → Campaigns had two dead controls on one panel. `New proposal` had no `onClick`, and every campaign row carried the same handler-less "More actions" Ellipsis with no row to bubble to. The panel describes itself as having "proposal entry points", so both now open the proposal path they name — the row control relabelled to *"Create a proposal for August retargeting"*.

### A fraud status with no cause and no way out

"Not checked" was a dead end in all three places it appeared, and the three did not agree. Orders printed the badge alone with no reason. COD review said *"Fraud check has not run yet"* — true, but not a cause and not something to act on. The order drawer's timeline asserted **"Fraud screening completed"** and printed `order.risk` beneath it, so an unchecked order read *"Fraud screening completed · Not checked"* in one breath.

- One `riskReason()` helper owns the sentence now, so the table, the queue and the drawer read the same, and the unchecked case names a cause: *"Screening timed out · provider did not answer in 30s."*
- The drawer step reports the state it is actually in — "Fraud screening did not complete", amber dot, the timeout reason — instead of claiming a screening that never finished.
- `Run check` is the way out, on the COD row and on the drawer step. It runs through a disabled *Checking…* state with the row reading "Re-running the check…", then replaces the badge and the reason in place: **Low risk · No critical signal · checked 16:24**. The verdict carries its own timestamp, so it cannot be confused with the check that timed out.
- The Orders table now carries the reason line too. It added no horizontal overflow: the table scrolls 194px at 1280px either way, unchanged by the added text.

### A decision with no stated consequence

Confirm and Skip decide whether a Purchase event is released, but the prototype must match the live deferred workflow: a skipped order remains restorable while a confirmed event is treated as final only after provider delivery is known. The consequence is now stated before the click and in the decision area: *"Confirm sends the held Purchase event to Meta, TikTok and GA4. Skip keeps it unsent and restorable."*

- The queue banner names all three destinations and distinguishes a reversible skip from a confirmed release.
- The Decision column carries the consequence once, and Recent decisions records the actor-facing outcome, timestamp, and restore path needed by the live API.
- The phone has no column header to hang that on, so it takes the card's footer slot — which was spending itself on risk copy already shown as a badge two lines above. The fraud reason and `Run check` moved to their own line above it.
- Fixing that copy exposed a layout bug it had been hiding: `.notice-bar` already carried `flex-wrap:wrap` and a 29px indent for a wrapped button, but `>span{flex:1}` let the text shrink instead of wrapping, so on a phone the sentence squeezed into a ~100px column beside "Learn how it works" and ran to eight lines. The text takes the full row now and the button drops beneath it, which is what the indent was always for.

### A status change with no way back

Incomplete checkouts changed a row on the status select's `onChange` and reported it with a toast that had no undo. A select is the easiest control in the portal to hit by accident — one stray scroll on a phone moves a customer from Active to Recovered, and the metric strip moves with it.

- The confirmation now carries the previous value and an **Undo** that restores it, and says which way it went: *"CHK-1048 moved to Recovered"* → *"CHK-1048 restored to Active."* Undoing an undo is not offered, so there is no loop.
- The window is 6s rather than 2.5s, and a `useRef` timer means a second toast cannot cut the first one's undo short — the old handler fired a bare `setTimeout` per flash, so overlapping messages raced.
- The phone footer held two buttons of near-equal weight in a `1fr 1fr` grid, which is a coin toss. `Call customer` takes the full width as the primary recovery action and `Create order` sits beneath it.

### Six tab strips, none of them a tab widget

Every tabbed surface in the portal was a row of plain `<button>`s carrying a visual `.active` class and nothing else, so a screen reader announced "Ad results, button" with no hint that it was one of four choices or which one was on. Two were worse than plain:

- `.campaign-tool-tabs` declared `role="tablist"` while none of its children claimed `role="tab"` — an invalid structure, a tablist reporting zero tabs, which is more misleading than no roles at all.
- `.settings-section-tabs` put `aria-label="Settings sections"` on a bare `<div>` with no role, where the label is simply dropped. The strip announced nothing.

Six sites patched six ways is how this drifted in the first place, so one `Tabs` component now owns the pattern and all six call it. It brings the keyboard behaviour the roles imply, which none of the strips had: a roving `tabIndex` so the whole strip is **one** Tab stop, arrows to move between tabs, Home/End to jump to either end, and wraparound at both ends. Orders has eight view tabs — a keyboard user previously pressed Tab eight times just to reach the toolbar beneath them.

Settings is the one strip whose content already lives in a single container, so it is the one place the full tab/panel relationship was free: `.settings-content` is now the `role="tabpanel"` and `aria-labelledby` points back at the selected tab, so a screen reader reaching the content hears which section it belongs to. The other five render content as bare sibling conditionals, and injecting wrapper divs to host a panel role would have meant restructuring `.analytics-grid`/`.account-grid` layouts for an attribute — `aria-controls` is optional in the ARIA spec, so those five carry the tablist/tab/selected triple without it. Settings also loses its `aria-current`: `aria-selected` is the property a tab is meant to carry, and two competing state attributes on one control is one too many.

Because only the selected tab is a Tab stop, its focus ring is the only one a keyboard user will ever see on the strip, so it now has an explicit high-contrast ring that reads against the active fill.

Verified at both widths: all six strips report `role="tablist"` with a label, the right tab count, exactly one `aria-selected="true"`, exactly one Tab stop, and zero role-less buttons left in the strip. Arrow/Home/End move selection and focus together and wrap at both ends; content switches with them (Orders: All 5 rows → Needs attention 1 → Delivered 1). At 375px the eight-tab strip scrolls horizontally inside itself — 911px of tabs in a 345px viewport, no document overflow — and arrow-key navigation scrolls the focused tab into view (`scrollLeft` 0 → 566 reaching the last tab).

### The same 12,400 events, two different months

Account → Plan & billing labelled the events counter *"Counted for Aug 1 – Aug 31, 2026"*. Analytics labelled the identical 12,400 *"Aug 1 – Aug 21, 2026"*. Only one can be the counted range, and the full-month version is the misleading one: it reads as a finished month closing 97.5% under limit, when eleven days of the cycle have not happened yet — exactly the reading that makes someone downgrade. The billing label now comes from the same constant Analytics prints, so the two pages cannot drift apart again, and it says **so far**.

That leaves the question the calendar window raises when it sits next to a charge date on the 24th, so a second line answers it: *"Calendar-month window · separate from the Aug 24 charge date."* The downgrade warning was reworded the same way — "…in Aug 1 – Aug 21, 2026 so far, with the cycle still open" — because a limit warning built on a month-to-date number has to say the month is not over.

### A date fact maintained in two places

`daysToCharge: 3` was a hand-typed number sitting beside a hand-typed `nextCharge: "Aug 24, 2026"` — two statements about the same gap, maintained separately, rendered in one sentence: *"BDT 799 on Aug 24, 2026, in 3 days."* Move either and the plan header starts lying with nothing to catch it. The snapshot date is a named constant now and the gap is derived from it, so the sentence cannot disagree with itself.

### Dead CSS

`.support-topics` had four rules — a 3-column grid, a 48px button, a hover state, a mobile single-column override — plus a slot in the shared mobile 44px selector list. No markup in the prototype uses the class. Removed; the shared 44px rule keeps its other twelve selectors.

### A bulk action that reported success it could not have had

Selecting every row in Orders → All orders and pressing **Book courier** flashed *"Courier booking queued for 5 orders."* Two of those five already had a consignment: WC-9282 is in transit on Pathao PT-849201, and WC-9280 was delivered by Steadfast SF-291044. The bar claimed to have booked couriers for parcels that had already travelled — in a live system, a duplicate consignment. The Delivered and In-transit views were worse: every order there is already booked, so the whole action was a no-op that still reported success.

`order.courier` holds the provider and tracking id once a consignment exists, so its absence is the whole test. Booking is scoped to the orders that can actually be booked:

- The button carries the real count when the selection is mixed — **Book courier (3)** for a 5-row selection — and the toast reports 3, not 5.
- The reason sits beside the count: *"2 already have a consignment and will be skipped."*
- When nothing in the selection qualifies, the action is **disabled** with the reason next to it — *"Every selected order already has a consignment · nothing left to book"* — instead of flashing a false success.
- A selection where everything is bookable shows no note at all, so the warning means something when it appears.

Verified across four views: All orders (5 selected → "(3)", note, toast "for 3 orders"), Delivered and In transit (disabled + reason), Ready to ship (2 selected, both bookable, plain label, no note). At the 1000px tablet band the note takes its own row rather than squeezing the actions; no overflow at any width.

### A dev-console full of noise

Every hot update re-ran `createRoot(document.getElementById("root")!)` on the same container, so the console filled with "already been passed to createRoot" errors — noise that buries the warnings worth reading while auditing. The root is cached on the container now and re-renders through it.

### A scrim styled only at one width

`.nav-scrim` got its entire rule — `position:fixed`, `inset:0`, `display:block` — from inside `@media(max-width:760px)`. Resizing past 760px with the nav open left it in the layout as an unstyled, statically-positioned full-bleed button. It is `display:none` by default and `display:block` where it belongs. Confirmed: at 1280px a bare `.nav-scrim` computes to `display:none; position:static`.

### A score built on unverified claims

Setup health's `Mark fixed` closed an issue on one click. The badge went to Resolved, the issue left the open count, and the Tracking score rose — with nothing checked. That is worse than having no score, because a number labelled "Tracking score" reads as measured. `Check my setup` and `Recheck now` had the same shape: both only restamped "last checked" and flashed a sentence, so the page could report a fresh check that had inspected nothing.

Closing an issue now requires a re-scan to pass:

- Each issue carries a `rescan` block — what the check re-reads, what it found, and, when it fails, the blocker that has to clear first. Two of the four sample issues still fail on re-scan, so both outcomes are visible rather than only the happy path.
- A failing re-scan keeps the issue open, keeps its severity badge, leaves the score untouched, and states the verdict on the row: *"Failed re-scan at 15:06 · Re-read the last 21 Purchase events sent to Meta · 3 of them still arrived with no order total. Do this first: Send order value and currency from the checkout, then re-scan."*
- A passing re-scan is the only thing that moves an issue to **Verified fixed** and the only thing that moves the score (73% → 80% on the GA4 issue). The verdict stays on the resolved row, so a green badge can always be traced to the check behind it.
- `Mark fixed` is gone. `Undo` became **Reopen**, and it clears the stored verdict so a reopened issue cannot show a stale "verified" line.
- The page-level action re-scans every open issue and reports the split — "Re-scanned 4 open issues · 2 verified fixed, 2 still failing" — instead of a bare success flash. The summary strip gained a third fact, *N failed the last re-scan*, so a stalled review is visible without opening rows.
- Both actions disable while a scan runs and the row shows what is being read, so the 850ms verify state is legible rather than an unexplained pause.

The panel's re-scan-all button is the only such control below 760px, because the page-header action is hidden there. Squeezed into the section-title's trailing slot it wrapped to three lines in a 73px column, so at mobile it takes its own full-width row.

### Layout

- Orders was the only page that scrolled the document sideways at 1280px, by 98px. The cause was `<span class="sr-only">Row actions</span>` in the last table header: `.sr-only` is `position:absolute`, `.table-wrap` had no positioned ancestor, so the span's containing block was resolved outside the scroll container and its box counted toward the document's scrollable width instead of the table's. `.table-wrap{position:relative}` keeps the label for screen readers and keeps sideways scroll inside the table.

### Verified correct, left alone

Setup guide progress math (83% = 5 of 6, "1 remaining"); Ad accounts spend split (13,300 + 4,700 = 18,000) and campaign counts (2 Meta, 1 TikTok) against `adCampaigns`; the read-only token guidance and the "Buykori never requests write access" note; Tracking & events "3 of 3 configured" against Setup guide's "3 destinations connected"; RedX correctly disabled in the Default courier select, which is what makes the note "Unconnected providers are not offered as a booking default" true; the Event tester sandbox banner; the deliberate empty and disabled states asked for above (`.campaign-empty`, `.chat-empty`, `.empty-state`).

### The Live Interaction findings, re-checked against the prototype

The `## Live Interaction Audit Findings` section above was written against the **production portal** (`client-portal/src/`), not this prototype. Each item was re-tested here so nobody re-chases a defect that this build does not have. One reproduced and is fixed above (bulk Book courier). The rest resolve as follows.

**Does not exist in the prototype — verified, not assumed:**

- *AI Ads crashes on `/ai-ads/campaigns` with `slice` of undefined.* All five AI Ads sub-tabs render — Overview, Campaigns, Analytics, Connected accounts, AI workspace — with no error boundary and no `NaN`/`undefined`/`[object Object]` in the output.
- *API log rows expose endpoint URLs including `api_secret=…`.* Delivery logs render hostnames only (`graph.facebook.com`, `events.tiktok.com`, `www.google-analytics.com`). No full URL and no query string appears anywhere on the page; `api_secret` does not appear in the source.
- *Delivery health alert shows while the history table still loads.* The prototype has no async loading state to desynchronise, and provider health reconciles with the table: Meta is Degraded at 1 failed of 34, and the table holds exactly one rejected Meta row.
- *Campaign Tools prefill a base URL that does not match the active store.* `baseUrl` initialises from `storeConnection.shopUrl`, so it is the active store. Sample identifiers are declared by the Sandbox mode banner.
- *Settings deep links show bare `Loading...`.* No `Loading...` string exists in the prototype.
- *Setup Guide reports `0 of 4 required` against six steps.* The prototype uses one denominator: 83% = 5 of 6, "1 remaining".
- *Account Plan & Billing has contradictory entitlement limits (50K vs 500K) and no successful payment history.* Both the plan panel and the Compare-plans Growth row state 500,000 events / 2,000 orders, and seven paid invoices run Feb–Jul.
- *Broken logo, platform and instructional assets across four pages.* Zero broken images across all 13 pages: every `<img>` completed with a non-zero `naturalWidth`.
- *Event detail sheet must lock background scroll, trap focus and normalize errors.* One `useDialogA11y` hook serves every drawer and dialog. Measured on the event sheet: dialog is labelled, focus moves inside on open, Tab is trapped at the last focusable, Escape closes, focus returns to the row that opened it, `body` overflow goes `visible → hidden → visible`, and the payload contains no `[object Object]`.
- *Mobile navigation needs `aria-expanded`, a labelled drawer, Escape and backdrop dismissal, focus return.* All present: the trigger carries `aria-expanded` and `aria-controls="portal-navigation"`, Escape closes, and `.nav-scrim` is the backdrop.
- *Fixed mobile support CTA occludes bottom actions.* No fixed bottom CTA exists; the only `position:fixed` element at 375px is the off-canvas nav.
- *Many controls below a 44px touch target.* Zero controls under 44px at 375px on all 13 pages, excluding the Delivery logs checkbox whose 313×44 `<label>` carries the hit region.
- *Orders rows expose too many simultaneous actions.* A desktop row has two controls: the order id and one **Open details** chevron. On mobile the card is a single activation target via `cardButtonProps`.
- *Incomplete Checkout needs one full-width primary action and a confirmation before Create order.* Create order opens a labelled dialog with an item preview, editable quantity, order note, Cancel and **Create draft order**. The mobile footer is one column with the primary action full-width.
- *COD should make Confirm primary and Skip secondary.* On the phone card Confirm purchase is 143×44 and Skip is a 62×44 quiet button — the hierarchy is already there, and putting a two-way decision behind a menu would add a tap without removing the risk.
- *Event logs hide the failure reason until a detail view.* The queue row already carries it: *"Failed · HTTP 400 · Purchase event had no order value"*, *"Retrying · HTTP 429 · Rate limited, attempt 2 of 5"*.
- *`Check Unavailable` fraud status has no reason or retry path*, *COD Confirm/Skip impact is unclear*, *status transitions need an undo*, *Setup Health allows Mark Fixed without a recheck*, *Analytics shows contradictory metrics*. All five are the findings already fixed and documented in the sections above.

**Deliberately left as is, with the reason:**

- *"Settings and Account duplicate their page heading in the topbar and body."* At 375px the topbar breadcrumb collapses to just the page name, so it does read the same as the `<h1>` directly beneath it. But `.portal-topbar` is `position:sticky; top:0`, so that label is what remains once the `<h1>` scrolls away — it is persistent context, not decoration. Removing it would leave the phone with no page identity while scrolled. The duplication is only visible at scroll position 0.
- *Tablet-band control heights.* Bulk-bar buttons are 31px between 761px and 1100px, because the 44px floor lives in `@media(max-width:760px)`. That is the prototype's existing convention (desktop Confirm/Skip are 36px) and it clears WCAG 2.5.8 AA at 24×24. Changing it is a design-system decision, not a defect fix.

### How it was checked

### Client 47 live AI Ads smoke (2026-08-24)

An authenticated read-only smoke was completed against `https://client.buykori.app` using the Client 47 beta session. The live AI Ads route opened successfully and Overview, Campaigns, Analytics, and Connected Accounts rendered without a client-side error. Connected Accounts showed Meta as active with granted permissions and a valid token; account identifiers were masked. Campaigns and analytics returned empty/zero states, which is valid data availability rather than a rendering failure. No Chat request, disconnect/select action, approval, queue, OAuth, or provider write was performed.

The local prototype remains intentionally backed by the mock API, so `localhost:3000` cannot reproduce this authenticated Client 47 state. Replacement staging still requires the prototype bundle to run against the authenticated backend/BFF and preserve the same server-derived gate.

All 13 pages and all 20 sub-tabs were swept for error boundaries, `NaN`/`undefined`/`[object Object]`/`null` in rendered text, relative timestamps, bare `Loading...`, and document-level horizontal overflow — clean on every surface at both viewports. Two accessibility sweeps (all pages, then every sub-tab) confirmed every button has an accessible name, every field has a label or `aria-label`, no placeholder-only fields, no image without alt, no duplicate ids. `npx tsc --noEmit` is clean.

The closing sweep re-walked all 13 pages at 1280×900 and 375×812: zero document-level horizontal overflow on every page at both widths, exactly one `<h1>` per page, and — at 375px — exactly one control measuring under 44px, the Delivery logs checkbox whose 313×44 `<label>` carries the hit region, which is the withdrawn finding below. All six tab strips pass at both widths.

Two findings from an earlier sweep were withdrawn as measurement errors, recorded here so they are not chased again:

- **"11 controls have no accessible name" (Account 4, Campaign tools 5, Delivery logs 1, Settings 1).** The check only looked for `aria-label`, `title`, `textContent` and `label[for=id]`. Re-run while also honouring a wrapping `<label>` and `aria-labelledby`, it returned empty for all four pages. The inputs are labelled.
- **"Delivery logs has a sub-44px checkbox."** The `<input>` is 15×15, but it is wrapped in the `<label>` that carries the hit region, and clicking the label toggles it. Measured at 375px the label is 313×44. Touch target is met. Measure the clickable wrapper, not the input.
