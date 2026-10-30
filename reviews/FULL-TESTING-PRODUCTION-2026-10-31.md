# Approved Testing edition promoted to production

User approved publishing the latest Testing version and explicitly cancelled the
proposed logo change. The existing olive O / charcoal OPortals.com wordmark is
retained in the site, Social Mirror and book editions. Logo mockups were never
installed and are excluded from this release.

## Published scope

- All five completed books: 150 pages in the approved social-poster visual style,
  distinct covers and original writing/exercises/source notes preserved.
- All nine encrypted full-book/sample files, matching cover/page media and the
  exact four-page paid-book samples.
- Current Testing homepage, ideas, free-book invitation and email-download gate.
- Social Mirror, including its compact Share / Save card / Insights $4 / Back
  icon controls and updated results heading and spacing.

Production snapshots are frozen separately; later Testing edits do not auto-
publish. This promotion uses `scripts/publish-approved-books.cjs`. The existing
database, profiles and five-response test record are retained. No migrations,
new votes, contact messages, purchases or emails were created by this release.
Prices, PayPal links, checkout verification and analytics are unchanged.

## Verification

- Build and 48 automated tests pass.
- Production homepage rendered from the actual Worker; catalogue filters,
  prices, purchase links and four-page preview UI checked.
- Production Social Mirror DOM/API regression: name-only creation, invitation
  sharing, five-response unlock, six-score card, compact icon controls, Back and
  optional $4 dialog. Uses local in-memory data only.
- All nine published PDF records match the approved Testing records byte for
  byte. All published book images match the approved Testing media.
- Original header wordmark and favicon match pre-promotion production bytes.
- Production Social Mirror uses root routes without Testing links.
- No physical-mobile/browser visual test or real PayPal transaction performed.

## Rollback

Previous production and latest Testing: saved version 154.
Record: `design-versions/before-full-testing-production.json`.
Git tag: `before-full-testing-production-2026-10-31`.
Private checkpoint: `private/checkpoints/before-full-testing-production/`.

Production: https://oportals.com/
Social Mirror: https://oportals.com/SocialMirror
