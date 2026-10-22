# Current Testing access and layout update

The user subsequently requested that the entire Testing storefront be accessible without an OpenAI account. `/Testing`, book popups, policy/contact pages, checkout previews, free samples, preview images and SneakPeak Ideas are now public. Owner reports and complete paid-book review files remain authenticated. Testing stays noindex; the root public homepage is unchanged.

Cards are compact with smaller covers and two-line descriptions. Book details open in a modal with a sticky Close button, Escape and backdrop dismissal, retaining the shelf beneath. Version 2/original PDF covers and sample files have been restored, and displayed covers are exports of those exact PDFs. The Arabic/bundle FAQ item was removed. Version 2 remains backed up.

The commercial implementation notes below describe the preceding pass; references to owner-only storefront access are superseded by the access rules above.

# OPortals Testing commercial preview

Scope: `/Testing` only. The existing public homepage, analytics script, PayPal URL, paid PDF and $15 verification rules are unchanged.

## Rollback checkpoint

- Version 2 tag: `testing-v2`.
- Checkpoint commit: `ea5e24f` (baseline was Sites version 61).
- Encrypted page and complete PDF set: `versions/testing-v2/`.
- Restore instructions: `versions/README.md`.
- Preserve `PREVIEW_CONTENT_KEY` for Version 2 and `PREVIEW_ENCRYPTION_KEY` for Version 1. New work uses `PREVIEW_V3_KEY`.

## Implemented

- Clear philosophy-for-everyday-life positioning, catalog and free-sample hero links; original reflection retained under Our Approach.
- Existing single shelf, four category filters, equal completed-card heights and smaller grayscale development cards retained.
- All paid editions show a planned $7.90 USD price; SneakPeak Ideas remains free.
- Distinct reference-inspired covers for Life Secrets, The Art of Attention and Man and People, with correct real typography and attribution. Covers are included in the owner-review PDFs and samples. Manuscript pages are unchanged.
- Consistent `/Testing/book/<slug>` URLs for ten titles. Real manuscript benefits, concepts, page lengths, source credits, preview status and access details.
- Actual PDF-page image previews (30 private images, including covers) and working owner-only sample/full PDF routes.
- `/Testing/checkout/<slug>` previews exist for three completed paid drafts only. They show $7.90 and cannot take payment. No links enter the old $15 checkout.
- About/contributors, publishing approach, contact, FAQ and private policy routes. Terms and refund text are explicitly proposed drafts.
- Contact opens the reader's own email app. It does not claim server-side message delivery or expose the email address as visible page text.
- Optional first-party event aggregates with explicit opt-in/withdrawal. Events contain only allowed event name, book slug, country code, count and update time. No PII, payment data, message content or reader ID is recorded.
- Owner metrics at `/Testing/metrics`; existing per-book download report at `/Testing/downloads`.
- Book-specific titles/descriptions and structured metadata, including honest unavailable offers for prelaunch editions. Testing remains owner-only and noindex.
- Responsive layouts, keyboard focus styles, reduced-motion support, lazy image loading and compressed WebP previews. Existing embedded DejaVu Serif book typography retained.

## Verification

- Automated Worker tests cover existing payments/access, Version 1/2 key compatibility, new owner-only routes, private media, new-key PDF access, unfinished/free checkout blocking, event consent/field validation and aggregate storage.
- DOM checks executed the actual page script: ten records, four filters, six unfinished titles at the end, all ten detail views, five policy/contact views, three disabled checkout views, sample image counts and measurement opt-in/withdrawal.
- Real encrypted page, seven PDF files and 30 WebP images decrypted through the Worker handler and compared byte-for-byte with source assets. Anonymous access blocked.
- PDF page counts: Life Secrets 30, Attention 30, Man and People 44, SneakPeak Ideas 14, paid-title samples 5/8/8. All full-book pages after the cover match their Version 2/source manuscript text. Contents outlines retained where present.
- Native deployment verifies publication when reported successful. Hosted anonymous access and public-file equality should be checked after publication.
- No browser-control tool is available in this session. DOM and responsive-source checks are not a rendered desktop/mobile browser test. Final visual/device testing remains required.

## Before public launch

1. Confirm $7.90 PayPal products/SKUs for each available title. The live verifier currently accepts exactly $15 for Life Secrets; it was intentionally not changed by this preview task.
2. Implement and test multi-book payment verification, verified purchase/revenue recording, confirmation, access recovery and delivery. No new paid purchase has been tested end to end.
3. Confirm publishing business identity, named contributors where applicable, public contact details, final licence/refund policy, consumer-rights checkout wording and analytics retention arrangements.
4. Finish reader review and approve each edition. Complete drafts are not claimed to have received validated reader outcomes.
5. Add newsletter integration only when a provider, consent text and delivery are configured. Free reading must remain accessible without subscription.
6. Keep bundles and unreviewed Arabic editions disabled. No fake reviews, discounts or scarcity are displayed.
7. Activate public SEO/share URLs only when the owner explicitly approves replacing the live site. Private preview links cannot be indexed or shared publicly without owner sign-in.

The cover reference arrived in the follow-up message and was used as stylistic inspiration; unrelated reference titles were not reproduced. No further reference image is required for this implementation.
