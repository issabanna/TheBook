# Compact Social Mirror results actions — Testing only

The results screen previously stacked full-width secondary buttons in two action
groups. It now has one compact four-button row immediately below the result card:
Share, Save card, Insights · $4, Back. Each action has a consistent outline icon,
visible label and accessible descriptive name. Share uses the existing light sage
palette. The optional paid action retains its explicit $4 price.

The toolbar is capped at 404px, with four flexible columns and 66px minimum button
height on mobile. It fits a 320px viewport without stacked full-width actions.
There are no icon-only controls, hover-dependent explanations or animation.
The results heading uses a clear sans-serif hierarchy; spacing, a subtle card
border and toolbar container give the screen a quieter visual structure.

Questionnaire, owner links, result calculations, card artwork/export and payment
handlers are unchanged. No new responses or purchases were created for this UI
change. The existing five-vote test profile remains available to review it.

## Validation

- 48 automated tests pass.
- Testing DOM flow: create a profile, share invitation, five simulated responses,
  unlock and render six metrics, then check the four icon actions, Back, reopening
  results and the existing $4 checkout dialog. Local in-memory test data only.
- Existing production Social Mirror regression flow passes.
- All original event-handler script bytes are identical to the checkpoint.
- Live HTML and Social Mirror snapshots and both book manifests are unchanged.
- Build passes. No automated browser or physical-device visual test was available.

## Scope and rollback

- Review: https://oportals.com/Testing/SocialMirror
- Only the Testing Social Mirror document incorporates the new results CSS.
- Live Social Mirror remains the published snapshot.
- Immediate rollback: version 153, recorded in
  `design-versions/before-mirror-result-controls.json`.
- Git tag: `before-mirror-result-controls-2026-10-31`.
