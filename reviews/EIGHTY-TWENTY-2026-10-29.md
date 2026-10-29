# Testing — 80/20 reading and notes edition

Starting point: the restored hosted version 146. The rejected single-column
revision and its cover refinements are not the visual baseline.

## Reading layout

- 103 principal reading pages across the four paid books use continuous prose
  in the 80% column and short existing reflections or practical steps in the
  20% column. The usable column widths are 276.8 and 69.2 pt, separated by a
  14 pt gutter, inside the existing 420 pt page width.
- Existing DejaVu Sans/Serif families and per-book blue, olive and lavender
  accents remain. Prose is 10.8 pt at 1.34 leading; margin notes are 9.2 pt.
- Longer everyday-life examples and reflection questions span the width below
  the columns. The reading flow is not split between equal-width prose columns.
- Digital page tails follow the content, as in the restored compact edition.
  The illustrations are not used to pad page counts. Contents pages, source
  notes and functional workbooks retain their preceding layouts.

## Illustration changes

28 new original AI-generated editorial illustrations replace selected weak
interior visuals. The scenes use everyday settings, people and philosophical
metaphors: a reading cafe, a place left at a table, a pause on a return path,
the same social custom across generations, different greetings, a concrete
first action and the repair of a shared piece of work. Art is integrated without
an additional enclosing interface-style frame. Dense Life Secrets idea pages
remain readable; artwork appears at the relevant chapter openings rather than
being cropped into thin banners on already full pages.

The full first Attention chapter was implemented and rendered before applying
the approach elsewhere. Its selection and urgency examples have new artwork;
its three-column inventory is redrawn as usable, subtly bordered writing fields.
Useful explanatory diagrams elsewhere are retained with the prepared restrained
palette and readable labels. This is not a claim that every diagram was redrawn.
Original diagram wording remains as captions where an illustration replaces it.
The independent-commentary and source-attribution notes in Man and People remain.

All five covers are pixel-identical to restored version 146. SneakPeak Ideas
contains the matching revised paid excerpts. Its source strips, links and
distinctions between completed books and future previews remain intact.

## Verification

- All 150 full-edition pages rendered and inspected in contact sheets, with
  representative illustrated and dense pages also inspected at larger size.
- Per-page word comparisons against version 146 pass for every book.
- Counts remain 32 / 31 / 44 / 24 / 19 pages. All four paid samples are exactly
  four pages and match the corresponding full-edition pages pixel for pixel.
- External-link sets, internal destinations, contents navigation, text bounds
  and font embedding checked. No PDF rendering warnings remain.
- The existing 44 automated tests, source build and catalogue/preview/checkout
  DOM checks pass. No actual phone-browser test or real payment was performed.

## Deployment and rollback

Only the Testing book payload and PDF-derived preview images change. The live
storefront, published-book payloads, prices, checkout, email gate, analytics and
Social Mirror behavior remain as before. A new asset key is added independently
of existing keys, so previous versions remain deployable. Full paid review PDFs
remain owner-only. No plaintext paid PDF is added to the hosted static assets.

Rollback: hosted version 146, commit
`7ae4076852269427b74b4b0e1878d8703b952e1b`, tag
`books-before-eighty-twenty-2026-10-29`. All preceding PDFs are also retained in
the local private checkpoint `before-eighty-twenty`.
