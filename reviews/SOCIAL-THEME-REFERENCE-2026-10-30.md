# Social-media design language — Testing reference

The user preferred the OPortals social-post identity and approved implementing
the proposed reference with a saved rollback. This is the agreed focused sample:
one Attention cover, two interior pages and a matching homepage section.

## Changed

- Testing homepage hero: white background, Anton condensed display headline,
  a single conceptual eye/leaf illustration, navy and pale-cyan accents and a
  light primary action. Existing headline, description, button destinations,
  logo, navigation and other homepage sections are preserved.
- Attention cover: prominent condensed title, restrained central illustration,
  OPortals.com wordmark and all original cover wording. Artwork expresses an
  ordinary detail becoming visible through attention, rather than a painted scene.
- Interior pages 5 and 6: bold headlines, simplified conceptual artwork, readable
  Open Sans prose and notes, and the approved 80/20 reading/notes layout. Existing
  explanatory caption wording and reflective questions remain.
- The four-page Testing sample and actual page-preview images reflect these
  changes. The sample's fourth page and the other 29 full-book pages retain the
  current edition. A separate three-page design PDF contains only the new pages.

Anton is used under its SIL Open Font License, supplied with source and preview
deliverables. New artwork was generated specifically for this reference.

## Retained and checked

All 32 Attention pages retain their wording and navigation. The other 29 pages
were checked pixel for pixel against the saved edition. Other books and samples
are byte-identical to the checkpoint. New pages were rendered and inspected;
font embedding and text bounds pass. The paid sample remains exactly four pages.

Header, footer, book section, free-book section, measurement dialog and all
Testing client scripts are unchanged. Catalogue prices, purchase links, preview
actions and owner-only full-book review controls pass the existing DOM check.
48 automated tests pass, including isolation of the new Testing PDF key.
Mobile headline widths were checked against 320–600 px layouts; no actual browser
or phone screenshot test was performed.

Only the two changed Attention PDFs are re-encrypted; the other seven Testing
records and all published records remain unchanged. Production HTML, Social
Mirror, published PDFs, preview images and PayPal configuration are frozen.
The deployment bundle is 49.1 MiB, within the host's size budget.

## Rollback

Hosted version **150**, commit `ce654ad7f07a854805264f3af31cee4ed82e1b81`,
tag `before-social-theme-2026-10-30`. The machine-readable rollback record is
`design-versions/before-social-theme.json`; preceding PDFs and Testing HTML are
also saved in the private checkpoint `before-social-theme`.
