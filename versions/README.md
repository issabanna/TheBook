# Testing design checkpoints

## Version 1
- User checkpoint requested before the visual journal rebuild.
- Source commit: fe39d18c1a2fad106c059b1276234693622fb709
- Git tag: testing-v1
- Encrypted page: versions/testing-v1.encrypted.json
- Uses the existing PREVIEW_ENCRYPTION_KEY. If that key is rotated, re-encrypt this checkpoint with the new key before deploying it.
- To roll back Testing only, restore this encrypted page to src/encrypted-preview.json, decrypt it into ignored private/Testing.html using the runtime preview key through hidden stdin, rebuild, and publish. Preserve public/index.html, checkout, and all other live functionality.
