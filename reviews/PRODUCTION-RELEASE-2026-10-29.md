# Approved production release — books and Social Mirror

User approval: "Deploy to prod", followed by "Including mirror".

## Published

- The approved Testing storefront, including the matching book covers, actual
  PDF page previews, Attention spread and two clearly labelled reader-feedback
  paraphrases. Existing product prices and PayPal links remain unchanged.
- All four 80/20 illustrated paid PDFs, their four-page samples and the revised
  free sampler. Verified purchases now deliver these approved full PDFs.
- Social Mirror at `/SocialMirror`, including the approved examples, name-only
  invitation creation, six-question anonymous friend responses, five-response
  results threshold, private management, downloadable/shareable card and the
  existing $4 detailed report after verified payment.

The storefront, Social Mirror document, encrypted PDF records and book-preview
images are separate production snapshots. Ordinary builds do not replace them
with later Testing work. Testing remains accessible at its existing URLs.

## Routing and protection

Production Social Mirror UI, invitation URLs, API calls, attribution links and
PayPal service return use `/SocialMirror`. Header/home-section links return to
the root storefront. The API accepts both production and Testing paths; the
essential secure HttpOnly device cookie covers both paths. Existing private
management tokens, duplicate-vote checks, origin checks and five-response
threshold remain. Full paid PDFs, customer inbox and owner reports remain
protected. Free-PDF email collection and optional newsletter consent remain.

The public legacy Life Secrets sample is also the approved four-page sample.

## Verification

47 automated tests pass, including production Social Mirror creation, voting,
five-response unlock, private results, close/delete, production/Testing asset
separation and verified paid-edition delivery. The built Worker public homepage
was rendered and its DOM checked for catalogue filters, four exact prices,
purchase links, matching page previews and reader feedback. The production
Social Mirror client was exercised with the real handler and an in-memory
database: invitation creation, social sharing URL, five votes, results card and
share/download controls. No real payment or actual mobile browser test was run.

## Rollback

Immediately preceding hosted version **148**, commit
`e55138a24b091292dbdbebdfdb0b6d0938a4f2a7`, tag
`before-eighty-twenty-production-2026-10-29`. Deploying it restores the preceding
live site while retaining the approved Testing preview. Existing runtime keys
are preserved; this release requires no key or database migration.
