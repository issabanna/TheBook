# Paid-book focus: retire the public free-sampler offer

User requested removing the free book because individual books already have
previews. Applied to Testing and production, including the shared Social Mirror
navigation, while preserving the current design and existing four-page samples.

Removed the homepage free-book section, secondary free-book hero action, header
link, SneakPeak Ideas shelf card and Free filter. Updated the catalogue summary,
store note and FAQ to focus on choosing books through their actual page previews.
The hero retains its clear Explore Our Books action. No new offers or popups added.

The sampler remains in the underlying edition records solely for existing-reader
links and access. Existing PDF files, email/download records, the email gate and
owner reports are preserved. No data was deleted. Social Mirror and the complete
weekly ideas journal remain available. Prices, payment integration and logo are
unchanged. No claim is made that this change alone will increase sales.

## Verification

- Build and 48 automated tests pass.
- Actual production homepage rendered from the Worker bundle.
- Testing and production DOM checks confirm no sampler section, header/hero CTA,
  Free filter, sampler shelf card or sampler promotion in FAQs.
- Three catalogue filters work; all seven remaining listings are accessible.
- Four available paid books retain exact prices, purchase links and four-page
  previews. Reader feedback and owner-only PDF review remain intact.
- Production Social Mirror flow and icon controls pass regression checks.
- PDF manifests, payment handler, Worker routing and logo match version 156.
- No real payment, physical-device or automated browser visual test performed.

## Rollback

Version 156: `design-versions/before-retiring-free-sampler.json`.
Git tag: `before-retiring-free-sampler-2026-10-31`.
Private checkpoint: `private/checkpoints/before-retiring-free-sampler/`.

Promotion uses the existing explicit publication script; future Testing changes
remain separate from production snapshots.
