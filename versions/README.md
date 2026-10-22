# Testing design checkpoints

## Version 1
- User checkpoint requested before the visual journal rebuild.
- Source commit: fe39d18c1a2fad106c059b1276234693622fb709
- Git tag: testing-v1
- Encrypted page: versions/testing-v1.encrypted.json
- Uses the existing PREVIEW_ENCRYPTION_KEY. If that key is rotated, re-encrypt this checkpoint with the new key before deploying it.
- To roll back Testing only, restore this encrypted page to src/encrypted-preview.json, decrypt it into ignored private/Testing.html using the runtime preview key through hidden stdin, rebuild, and publish. Preserve public/index.html, checkout, and all other live functionality.

## Preview encryption compatibility
- Version 1 continues to use PREVIEW_ENCRYPTION_KEY; preserve that runtime secret.
- Current preview pages with keyEnv set to PREVIEW_CONTENT_KEY and completed preview PDFs use PREVIEW_CONTENT_KEY.
- The handler selects the key from the encrypted page metadata, so the preserved Version 1 snapshot remains restorable without changing its key.

## Version 2
- User checkpoint requested before the commercial-improvement pass, 22 October 2026.
- Baseline source commit: 0d0583386163925bd0d7e44f181acc71252cf722 (Sites version 61).
- Git tag: testing-v2 (checkpoint commit).
- Complete encrypted snapshot: versions/testing-v2/page.encrypted.json and versions/testing-v2/books.encrypted.json.
- Both use the preserved PREVIEW_CONTENT_KEY. Do not rotate or delete that secret.
- Restore the two snapshots to src/encrypted-preview.json and src/encrypted-preview-books.json, preserve public assets and checkout, rebuild and publish. The worker must support PREVIEW_CONTENT_KEY markers.
- Local ignored manuscript/build sources and PDFs are retained under private/checkpoints/testing-v2.
- Later work uses PREVIEW_V3_KEY independently, so Version 2 remains decryptable.
