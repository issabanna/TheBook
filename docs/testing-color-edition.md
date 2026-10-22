# Testing color edition

Seven titles have regenerated PDF covers, colored-paper interiors, and matching shelf/sample images. Life Secrets is excluded: its existing encrypted PDF, sample and image records are preserved exactly. The public sales homepage and payment assets are unchanged.

Each cover uses DejaVu Serif/DejaVu Sans and a title-specific vector symbol: focus/attention, social patterns/individual agency, balance/managerial judgment, converging direction/leadership, selected calendar blocks/time, distinctive contribution/standing out, and overlapping pages/free anthology. Palettes use deep teal, olive, navy, plum and clay with warm accents. Interior diagrams retain their explanatory content; reading pages use coordinated tinted paper and narrow colored edge bands.

Full-book page counts remain 30, 44, 24, 24, 24, 24 and 14. Existing interior text is preserved exactly after whitespace normalization. Free samples are extracted from the regenerated books; their pages, cover and typography match the full editions. The older two samples retain eight pages; practical handbooks retain seven.

Generation: scripts/recolor-testing-books.py uses the immutable local private/checkpoints/before-color-edition/books manuscript backup. Source manuscripts remain outside tracked public source. Packaged runtime contains encrypted assets. The new edition uses PREVIEW_V4_KEY, preserving earlier keys for Life Secrets and rollback snapshots.

Verification: rendered cover/interior contact sheet reviewed; all text bounds checked; page count and interior text compared; regenerated encrypted assets decrypted through actual Worker routes and matched to local PDF/image bytes; private full-book access boundaries checked; existing tests and DOM checks passed. Browser layout QA was unavailable.
