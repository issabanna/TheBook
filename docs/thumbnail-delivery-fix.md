# Cover delivery audit and repair

All 18 current covers loaded during the HTTP audit. The exact intermittent browser failure in the screenshot was not reproduced. Stand Out for Something was 10,672 bytes; the other covers were approximately 12–27 KB. Excessively large cover downloads were not found.

Confirmed weaknesses: every cover response used `private, no-store`, forcing repeat downloads, and three public covers still depended on an old encrypted-preview delivery path. Their existing public bytes were copied exactly into both approved media snapshots; no cover design or paid PDF was changed.

The repair adds a 320px WebP variant for every cover, responsive `srcset` selection and content-versioned URLs. Default cover payloads total 170,990 bytes versus 390,948 bytes for the originals (56% smaller). High-resolution displays can still select the original. Featured and recommended covers also use responsive sizes.

Known published WebP files now use a public static route without private-preview key checks or decryption. Versioned URLs receive immutable browser caching; unversioned URLs use a shorter cache lifetime and ETags support conditional 304 responses. Testing retains private caching and preview authorization. Paid PDF access remains protected.

Automatic image recovery now clears a failed `srcset` candidate before retrying the default thumbnail, so the browser cannot keep selecting the failed candidate instead of the retry URL.

131 automated tests passed. The compiled Worker served all 36 original/thumbnail URLs without preview keys and with the expected cache/ETag headers. Hosted validation is recorded separately after publishing. This addresses the confirmed delivery weaknesses; it does not prove that every possible browser/network failure is eliminated.
