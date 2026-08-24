# Client Portal UI/UX Audit

## Scope

Desktop and mobile review of the local client portal, with emphasis on Orders & Shipping and consistency checks across Dashboard, Ad Insights, Incomplete Checkouts, Event Tracking Activities, AI Ads, Settings, and Account.

## Critical Findings

1. Brand and platform image assets are broken in the local client experience. The main logo resolves to `/static/css/brand-logo.png`; multiple platform and guide images also fail locally.
2. Page ownership is visually duplicated. Orders, Settings, and Account render the page title in both the global header and page body.
3. The information architecture mixes orders, shipping, purchase-event holds, tracking, and ad operations at the same navigation level without strong workflow grouping.
4. Orders desktop layout spends substantial horizontal space on small status controls while omitting product, location, payment, courier, and latest-event context from the primary scan path.
5. Primary actions are repeated per row as several icons/buttons. This makes the table look busy and weakens the distinction between the recommended next action and secondary commands.
6. Summary cards and containers are used repeatedly across pages. The result is clean but generic, with weak hierarchy and large areas of low-information whitespace.
7. Several operational states conflict or lack explanation, such as event totals with a 0% success rate and health percentages that do not visibly connect to next actions.
8. Loading surfaces replace most page content with a bare `Loading...`, causing a sharp visual shift and reducing perceived quality.
9. Mobile Orders is functional but action-heavy. Every card exposes booking, invoice, edit, and status controls before the user opens details.
10. The product uses mostly English operational language despite a likely Bangla-speaking merchant audience. A deliberate localization strategy is missing.

## Recommended Direction

- Use one page title and a consistent workspace breadcrumb.
- Organize navigation around merchant jobs: Overview, Orders, Shipping, Growth, Tracking, Settings.
- Make Orders a dense, high-signal work queue with saved views and contextual bulk actions.
- Put secondary information and commands in a right-side detail drawer.
- Show product, customer location, payment mode, risk, fulfillment, total, and age in the main table.
- Reduce the number of floating cards. Use bands, dividers, and a single framed data tool where appropriate.
- Establish semantic colors for risk, fulfillment, health, and action states instead of reusing blue/indigo as the dominant signal.
- Replace bare loading text with stable skeletons that preserve layout.
- Define a Bangla/English content policy before redesigning every screen.

## Benchmark Principles Applied

The prototype follows common Shopify/ShipStation-style order-operation patterns found during the audit: centralized order queues, filters and saved views, batch processing, clear fulfillment state, contextual detail surfaces, and automation-oriented next actions.
