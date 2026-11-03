# Recurring character — Testing study

The user requested the faceless ink-and-watercolour figure from the “What if nobody noticed?” post as a recurring OPortals character, then chose **Testing and a book sample first**.

This study introduces a four-pose reference sheet and one coherent scene featuring the same figure. The scene appears in the Testing homepage hero and page 6 of The Art of Attention. A Testing-only review section links to the three-page book sample, the pose sheet and a 1080×1350 future-post concept. The wordmark, covers, white paper, fonts, book wording and page counts remain intact. The other 31 pages of the book render identically to the current edition. The full revised Testing PDF remains owner-only.

The two revised PDF records use `CHARACTER_PREVIEW_KEY`. Production storefront HTML, Social Mirror HTML, paid editions and media snapshots are unchanged. Character-only media use the existing Testing-collection prefix so root media URLs return 404 until explicitly promoted. There are no changes to prices, payment links, purchase delivery, analytics data or database migrations.

Reusable artwork and future-image guidance are saved in `brand/CHARACTER.md` and `brand/references`. The post concept is not scheduled or published to a social network. The reference's high view count is a reason to test this direction, not proof that the character caused its performance.

Validation: all book words, links, cover pixels and page counts match the prior edition; only page 6 has changed visually. All three sample pages render identically to their full-book sources. The entire character scene fits its illustration slot without clipping heads, feet or thought bubbles. The post is 1080×1350 pixels (4:5). All 87 site tests, Worker build, syntax and whitespace checks pass. Browser automation is unavailable; rendered PDF/post inspection, DOM execution and hosted HTTP checks provide verification.

Rollback: saved version 171, tag `before-character-preview-2026-11-03`, recorded in `design-versions/before-character-preview.json`.
