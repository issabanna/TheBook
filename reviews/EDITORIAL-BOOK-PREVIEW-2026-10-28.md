# OPortals editorial book preview

Testing only. The published storefront, published PDF assets, PayPal destinations and verified paid delivery are retained.

## Rollback

Before-state: Git tag `books-before-editorial-preview-2026-10-28`, commit `c921b728c9f89aa3c0e457d64a98bf2402305e07`, hosted version 135. Original local manuscripts remain untouched in `private/books` and have a second local checkpoint. For a book-only rollback, revert the editorial-preview commit and rebuild; the separately committed Social Mirror percentage-weight fix remains. Redeploying saved version 135 is also available as a full pre-preview rollback. The added runtime encryption key is unused by the older version; it does not require key rotation or removal to roll back.

## Changes

- Four paid editions and the free anthology regenerated. Page counts stay 32, 31, 44, 24 and 19 respectively.
- Covers share publisher typography and wordmark but have distinct compositions and palettes: attention / deep blue and gold; everyday choices / ochre and olive; society / lavender and charcoal; leadership / sage; anthology / neutral collection collage.
- Interior headlines use the same embedded DejaVu Serif family as the website. Original body text, exercises, diagrams, source notes and page indices are preserved.
- Four new conceptual interior artworks occupy six audited empty spaces. They supplement the diagrams. Two attention placements, two Life Secrets placements, one Ortega introduction and one leadership introduction.
- Sampler excerpts are taken from the revised editions. The sampler corrects publication-status copy for Lead Without the Noise, which is already available. No philosophical content is rewritten.
- Paid PDF samples contain exactly four pages. SneakPeak Ideas remains the complete free anthology, with its existing email gate.
- Website shows PDF-derived covers/pages, an actual two-page attention preview, and two explicitly labelled paraphrases of founder-reported reader feedback. No invented third testimonial, ratings, identities, locations, purchase verification or sales claims.
- Complete revised review PDFs use the existing owner boundary. Public samples remain public. Live purchases continue to deliver the published editions until approval.
- Social Mirror percentage typography is lighter in both DOM cards and PNG exports.

## Verification

- All 150 pages rendered; collection contact sheets and representative full-resolution opening pages reviewed for layout. This is PDF render review, not browser testing.
- Text token comparisons on every retained interior page; only intentionally corrected sampler status paragraphs differ. Page counts and four-page sample counts verified.
- 44 automated tests passed, including two new checks proving Testing/PDF edition isolation, owner-only complete files, and failure when the new encryption key is missing. Focused preview tests repeated after the final key-selection adjustment.
- DOM checks cover catalogue filters, paid book purchase links and prices, all four-page preview grids, editorial image paths, two paraphrased reader stories and the owner review action.
- Browser/mobile visual rendering and a real PayPal transaction have not been exercised in this environment. No claim that this design increases sales has been made.
