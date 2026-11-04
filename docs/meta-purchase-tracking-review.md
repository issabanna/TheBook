# OPortals Meta purchase tracking — production release

Prepared 4 November 2026, Asia/Amman. **Production promotion authorized after Testing review. Public pages now use the reviewed Meta integration; separate visitor consent is required. Testing remains isolated. Server-side Purchase delivery still requires the missing CAPI secret.**

## Existing assets and inspection

- Dataset/pixel: **OPortals Website — 4490808921236945**. The implementation is restricted to this dataset; it never creates another one.
- Intended ad account: **28730387193289954**. Business portfolio: **1448477050580134**.
- User-supplied test code: **TEST10333**.
- Inspected existing GA4 loader/SPA navigation, measurement controls, shared and dedicated PayPal checkout paths, PDT verification, independently verified IPNs, transaction allocation, receipt recovery, protected PDF delivery and the conversion ledger before editing.
- Existing GA4 property: `G-H7Z99E31L4`.
- Existing product configuration confirms **The Art of Attention: 32-page English digital PDF, $8.99 USD**. Other books retain their own configured identifiers/prices.
- Hosting environment revision 29 had no Meta token or sandbox merchant configuration. Production runtime configuration enables the existing pixel in live mode and sets a new-purchase activation timestamp. The CAPI secret is not configured. No PayPal settings, campaigns, budgets, social schedules, book files or prices were changed.

## Changes prepared

### Consent and browser pixel

The existing Privacy & measurement dialog gains a separate, unchecked option:

> **Allow Meta advertising measurement**
>
> Optional. Share book views, checkout activity and verified purchases with Meta to measure our advertising. Meta may link this activity to your account. No payer details or payment credentials are shared. Leave unchecked to keep it off.

Existing analytics acceptance alone does not enable Meta. No new automatic consent popup is introduced. Checkout/receipt pages get access to the same choices where the full storefront dialog is absent.

- One guarded SDK load/initialization for the existing dataset.
- Explicit `PageView` on permitted public page navigation; duplicate hooks and SDK push-state automation are suppressed.
- `ViewContent` for the actual selected book and `InitiateCheckout` with its identifier, configured price, quantity and USD currency.
- URL sanitization preserves approved UTM values, consented `fbclid` and the validated selected-book checkout parameter. Private tokens, transaction IDs and unrelated query values are removed before SDK initialization.
- Private Social Mirror links, receipts, downloads, owner browsing, automation and Testing routes do not load the browser pixel. Isolated Meta test mode also disables browser dispatch.
- Withdrawal revokes SDK consent, clears Meta cookies and revokes the server context. Reacceptance grants SDK consent again without duplicate initialization. Context-specific server revocation tombstones prevent a delayed grant response from restoring withdrawn consent.
- GA advertising storage remains denied; Meta consent is separate from GA analytics storage.

### Verified server Purchase and deduplication

**Meta Purchase is server-only. No browser `Purchase` is sent.**

The new handler runs only after existing PayPal verification and selected-book resolution. Genuine events additionally require the existing verified conversion ledger to agree on the book and amount.

- Live Meta `event_id` and `order_id` equal GA4's stable opaque `transaction_id`: `OP-…`.
- Currency, value and product identifier come from the same verified transaction/allocation used for GA4 and fulfillment.
- A unique database outbox row prevents accepted events from being sent again on refresh, concurrent retries or repeated IPNs.
- Short delivery leases prevent concurrent sends. Temporary/ambiguous failures retry the identical event ID with backoff. Retry attempts stop after a 24-hour delivery window; sent IDs remain durable.
- Delivery runs in the Worker's background context. Meta errors do not revoke authorization, change the selected book or block the PDF response.
- Pending events can drain on subsequent consented visits or existing receipt/webhook activity. Owner-only status/retry endpoints are prepared at `/Conversions/meta` and `/Conversions/meta/retry`. No new scheduled task was created.
- No event is generated merely by a thank-you visit, Buy click, cancellation, free preview, PDF download, pending/invalid payment or unallocated shared payment.
- Historical receipts predating activation cannot be backfilled as new Meta purchases.

### Attribution and data minimization

- Approved first-touch UTM parameters persist through checkout. Shared-book attribution is bound to the immutable selected checkout order.
- Meta receives the canonical book URL with approved campaign parameters, book SKU, verified USD value, opaque order ID, a hashed anonymous context ID and consented `_fbp`/`_fbc` when available.
- No payer email/name, raw PayPal transaction ID, payment credential, download token, friend response or IP address is sent to Meta.
- Access token is read only from server environment configuration and sent in the server request's Authorization header. It is not in HTML, client JS, database payloads or logs.
- Raw Meta error messages are not stored. Matching identifiers are removed from the outbox payload after acknowledgement; revocation clears them from the context and pending records.
- Missing consent or unresolvable attribution results in no Meta Purchase, rather than guessing a customer/source. This means Meta counts can be lower than the private verified-sales ledger.

### CSP

The prepared CSP adds only `https://connect.facebook.net` to script sources and `https://www.facebook.com/tr/` to image/connect sources. It adds no Facebook wildcard, frame permission or public Graph API connection. CAPI is server-to-server.

## Verification completed

**127 automated tests passed; none failed or skipped.** This includes 17 Meta tests, three historical Testing-isolation tests, three production-promotion tests and all 104 existing regression tests.

| Scenario | Local result |
| --- | --- |
| Old analytics consent without separate Meta consent | No SDK or Meta event |
| Public page and SPA navigation | One initialization; PageView/ViewContent deduplicated |
| Book-specific checkout | Correct selected SKU, real $7.99/$8.99/$9.99 values; sanitization preserves selection |
| Preview open | GA4 preview event; no Purchase |
| Verified Art of Attention payment | GA4 and CAPI order/SKU/value/currency agree at $8.99 USD |
| Selected shared-checkout payment | Correct $7.99 book retained through verification and IPN ordering |
| Repeated receipt, concurrent verification and repeated IPNs | One accepted outbox event |
| Cancellation, pending, refunded, underpaid, foreign-currency or wrong-seller payment | No new Purchase |
| Meta error/outage and retry | PDF remains available; same event ID retried; no raw error/token exposure |
| Withdrawal, reacceptance and delayed consent responses | Revocation/regrant work; stale grants cannot undo withdrawal |
| Existing excluded session | Queued event is dropped |
| Historical receipt with a new campaign | No new Meta attribution/Purchase |
| Sandbox/test mode | `TEST10333` supplied; `TEST-OP-…` ID; no genuine ledger or GA4 Purchase |
| Test/live mode separation | Test outbox rows cannot drain into live mode; real payments cannot be submitted as tests |
| Background delivery | Verified download response returns before Meta acknowledgement |
| Existing checkout, protected PDFs, auth, SEO and Social Mirror | Existing tests still pass |

Worker build, bundle syntax and whitespace checks passed. Compiled-Worker smoke checks verified public home, book page, Social Mirror and pixel asset responses; a canary token did not appear in output, and private Meta status required owner authentication.

Payment/API responses were **mocked** in these tests. No real card was charged, no actual PayPal merchant sandbox transaction was made, and no event was transmitted to Meta or GA4 by the test suite.

## Final external verification status

| External check | Status |
| --- | --- |
| Real Meta Test Events receipt under `TEST10333` | **Not run — CAPI access token has not been securely supplied** |
| Actual `events_received` / Meta trace ID | **Unavailable**; mock acknowledgements are not Meta results |
| Meta Events Manager browser-event observation | **Not run**; no connected Meta account/browser session available |
| GA4 event payload consistency | **Passed locally**, including transaction_id, item, actual value/currency and UTM persistence |
| GA4 DebugView / property receipt | **Not verified**; no GA Admin/DebugView connection available |
| Real PayPal sandbox round trip | **Not run**; separate sandbox merchant setup absent |
| Physical mobile / real SDK / CSP network test | **Not run**; browser tooling unavailable in this environment |
| Dataset available to the specified ad account | **Not verified**; no Meta business-management credential/tool available |

## Secret setup and test isolation

The confirmed host is **ChatGPT Sites**, with a managed Worker and native Sites environment-variable configuration. The available documentation configures hosted secrets through native Sites tools; it does not establish a self-service dashboard menu. **No verified dashboard click path was available, and none is invented here.** Secure token entry remains unresolved. Do not paste the token into chat or add it to the repository.

The server secret must be named **`META_CAPI_ACCESS_TOKEN`** and marked **secret**. Once a supported secure entry is available and the owner confirms saving it, validate its access to this existing dataset. A saved Sites environment change requires an approved deployment to take effect; saving a secret alone does not activate the running Worker.

Prepared runtime keys:

| Key | Purpose |
| --- | --- |
| `META_PIXEL_ID` | Existing `4490808921236945` only |
| `META_CAPI_ACCESS_TOKEN` | Server secret, never public |
| `META_TRACKING_ENABLED` | Off unless explicitly set to `true` |
| `META_TEST_MODE` | `true` only in an isolated test runtime |
| `META_TEST_EVENT_CODE` | `TEST10333` in that test runtime |
| `META_PURCHASES_FROM` | Explicit UTC activation timestamp; no historical purchase backfill |

For genuine server integration testing, use a separate sandbox merchant configuration/test database with `PAYPAL_ENV=sandbox`. **Do not switch the live site's PayPal environment or live database into a test setup.** Test mode accepts sandbox payments only, labels outbox records `test`, adds `test_event_code`, prefixes event IDs `TEST-OP-…`, and excludes them from the genuine sales ledger and GA4 Purchase payloads. Browser Meta dispatch is disabled in this isolated mode so browser test traffic is not mixed into ordinary dataset traffic.

After approved integration testing, genuine production mode uses the existing live PayPal settings, `META_TEST_MODE=false`, no active test code and a fresh activation timestamp. The existing user consent still controls measurement; enabling the runtime flag alone does not opt visitors in.

## Remaining Meta account setup

These are owner checks, not completed account changes. Open [Meta Business Settings](https://business.facebook.com/settings?business_id=1448477050580134) for portfolio **1448477050580134** and [Events Manager](https://business.facebook.com/events_manager2/). Labels can vary by account interface.

1. Locate the existing **OPortals Website / 4490808921236945** dataset under Data sources / Datasets (or Pixels), and confirm this business owns it or has the necessary partner permission. Do not create a replacement.
2. Check its Connected assets / ad-account access for **28730387193289954**. If absent, a portfolio administrator should connect that existing ad account and grant the operator the necessary dataset/ad-account permissions.
3. Create/use a dataset-authorized CAPI token and store it through a supported secure secret-entry path. Check traffic permissions allow `oportals.com` and any required business/domain verification.
4. Inspect automatic-event/Event Setup Tool rules for additional Buy/thank-you Purchase rules, and automatic advanced matching. Our code disables automatic browser configuration and does not emit browser Purchase; account rules should not add another purchase source.
5. Run Test Events with `TEST10333`, confirm a server Purchase uses the expected test ID, book, $8.99 USD and a single accepted event despite repeated verification. Record actual receipt/diagnostics, not just an HTTP success from a mock.
6. Separately verify browser PageView/ViewContent/InitiateCheckout and GA4 DebugView on the approved test setup; do not use a real paid transaction without approval.
7. Confirm the existing dataset and Purchase event are selectable in the unpublished Sales campaign. Leave the campaign unpublished and its **$3/day total campaign budget unchanged**.

Reference documentation: [Meta CAPI usage](https://developers.facebook.com/docs/marketing-api/conversions-api/using-the-api/), [server event fields](https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/server-event/), [pixel consent](https://developers.facebook.com/docs/meta-pixel/implementation/gdpr/). Direct documentation requests were rate-limited and account help requires login; account-specific configuration remains unverified.

## Deployment and rollback

Review branch: `meta-purchase-tracking-review`, based on production version 179 (`a1f34252bb4eb5d6d9eab210e88c8f587bace5f9`).

After the Testing-only version 180 passed hosted checks, the owner explicitly authorized production promotion. Public routes now use the reviewed handler; `/Testing` continues to force isolated Meta test mode with TEST10333. Existing PayPal settings and encrypted book files remain unchanged. The Meta runtime settings enable consent-gated browser tracking in live mode and establish a new-purchase cutover; the access token is still absent, so actual CAPI delivery and Meta Test Events receipt remain unverified. The version-180 saved deployment and commit are recorded in `design-versions/before-meta-production.json` for rollback. No ads were launched and the $3/day draft campaign budget was not changed.
