# Feature The Art of Attention in the bottom bar

Replace the Life Secrets bottom promotion on Testing and production with The Art of Attention. Update the cover/alt text, title, short attention-focused description, 32-page format line, book link, purchase target/analytics ID, $8.99 price and three-page sample link together. Label the promotion “Featured book.” Preserve the existing responsive bar layout and all other bookstore sections.

Validation: all 83 tests pass; build, bundle syntax and diff checks pass. Parse pages served by the actual built Worker and verify the bar's title, image, price and all links on both root and Testing. Hosted checks verify the artwork, three-page sample and existing $8.99 PayPal redirect after deployment. No purchase is made. Payment logic, allocations, runtime configuration and book files are unchanged.

Rollback: version 167 / tag before-attention-bottom-bar-2026-11-03; exact identifiers in design-versions/before-attention-bottom-bar.json.
