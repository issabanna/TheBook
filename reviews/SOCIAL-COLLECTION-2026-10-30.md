# Complete social-theme reading edition — Testing

Extends the approved social-media reference beyond Attention's cover and two
interior pages to all five completed editions. Production stays on version 152.

| Book | Pages | Direction |
| --- | ---: | --- |
| The Art of Attention | 32 | Navy/cyan; selection, presence and returning |
| Life Secrets | 31 | Forest/sage/gold; action, judgment and ordinary meaning |
| Man and People | 44 | Muted plum/slate; encounter, inherited customs and circumstance |
| Lead Without the Noise | 24 | Teal/sage/navy; shared direction, listening and repair |
| SneakPeak Ideas | 19 | Anthology cover and matching revised paid excerpts |

All 150 pages are included. The three approved Attention reference pages remain
pixel-identical; the other 147 pages receive the collection's display/body font
system. Four new covers have distinct concepts. Twenty-three chapter/support
scenes use new original conceptual artwork instead of the older scenic strips.
Functional diagrams, exercises and useful supporting narrative art are retained.

Text is selectable, with Anton display type and Open Sans body/notes. White
backgrounds, native diagrams, subtle rules, original margins, page numbers and
the approved 80/20 reading/notes structure remain. Raster art is sized for digital
reading; typography and native diagrams remain vector. The sampler retains the
distinction between available-book excerpts and future previews.

## Verification

- Rendered all 150 pages and inspected all eleven contact sheets.
- Per-page word counters, original dimensions and navigation signatures match
  the pre-expansion authoritative PDFs.
- Text bounds checked; no missing-glyph/render warnings.
- All four paid samples contain exactly four pages, pixel-matching their full
  editions. Website cover and page images exported from these exact PDFs.
- Forty-eight automated tests, catalogue/preview DOM checks and existing
  production Social Mirror flow checks pass.
- Actual bundled Testing routes decrypt all nine PDFs to their source hashes.
  Paid books remain protected; the free sampler's email gate remains active.
- Published HTML, published PDF manifest, published media and production Social
  Mirror snapshot remain unchanged. Prices and payment integrations unchanged.
- No automated browser/physical mobile visual test or real payment performed.

## Review and rollback

- Website: https://oportals.com/Testing#books
- Local review: `/workspace/outputs/OPortals-Social-Collection/Collection-Design-Review.pdf`
- Complete PDFs, samples, page-by-page audit and rendered sheets are alongside it.
- Immediate rollback: saved version 152, recorded in
  `design-versions/before-social-collection.json`.
- Git tag: `before-social-collection-2026-10-30`.
- Private authoritative checkpoint: `private/checkpoints/before-social-collection/`.
- Regeneration script: `scripts/build-social-collection.py`.
- PDF verification: `scripts/check-social-collection.py`.
- Testing assets use `PREMIUM_COLLECTION_KEY`; all existing runtime keys retained.

Testing is the review destination. Do not promote the published snapshots without
the user's approval of the complete collection.
