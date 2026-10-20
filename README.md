# O Portals / Life Secrets

Source for the O Portals website and verified PayPal-to-PDF backend.

**Website:** https://life-secrets-guide.issawbanna.chatgpt.site

The checkout stays closed until the required PayPal settings are connected. No real payment has been made during development.

## How it works

1. `/checkout` sends buyers to the existing PayPal payment link only when required server settings exist.
2. PayPal returns the buyer to `/paypal/return?tx=TRANSACTION_ID`.
3. The server asks PayPal's Payment Data Transfer (PDT) endpoint for the transaction details. It never trusts a browser's `paid`, `amount`, `status`, or email values.
4. Only a completed payment for **$15.00 USD**, the configured recipient and product code **LIFE-SECRETS** unlocks a signed, 24-hour download URL.
5. `/download` checks the signature, expiry and PayPal payment before decrypting and returning the PDF.
6. Optionally, a verified IPN sends a seven-day download link to the PayPal payer's email via Resend. Email outages return an error so PayPal can retry.

Buyers can return to `/paypal/return` and enter the transaction ID from their receipt if they close the return page. Treat receipt transaction IDs and download links as private; they grant access after verification. A signed download link can be shared until it expires. This is not DRM.

## Connect PayPal before opening sales

In the PayPal business account that owns payment link `CS8XK9B6XLU64`:

1. Check that this link charges a fixed **15.00 USD**, with no additional shipping or tax that changes the gross total checked here. Confirm the item/SKU sent as `item_number` is **LIFE-SECRETS**. If the current link editor does not expose that field, use a supported PayPal button/integration that sends it, or adjust the backend to a verified product identifier actually present in a real sandbox response. Do not remove product verification to work around setup.
2. Enable **Auto Return** and set the return URL to:
   `https://life-secrets-guide.issawbanna.chatgpt.site/paypal/return`
3. Enable **Payment Data Transfer (PDT)** in Website Payment Preferences. Store the PDT identity token as the hosted secret `PAYPAL_PDT_TOKEN`. Set `PAYPAL_RECEIVER_EMAIL` to the primary receiving email shown in PayPal's verified transaction response. Never commit these values or put them in browser code.
4. Confirm that the payment-link-specific confirmation settings do not override the intended return URL. The return must include `tx` for automatic verification. The receipt-ID form provides a fallback when it does not.
5. If enabling email, set the IPN Notification URL to:
   `https://life-secrets-guide.issawbanna.chatgpt.site/api/paypal/ipn`
6. Verify the entire flow in sandbox with sandbox credentials and a sandbox payment link before opening live checkout. Then switch back to live credentials/link and verify the live configuration. Merely providing credentials does not prove merchant setup is correct.

PayPal settings can vary by account and product. If PDT or the product identifier is unavailable on this link, migrate checkout to PayPal Orders API; do not treat the return URL as authorization.

## Runtime settings

Configure values through Sites runtime environment settings, not this repository. New runtime values require redeployment of the saved version to take effect.

| Name | Purpose |
| --- | --- |
| `PAYPAL_RECEIVER_EMAIL` | Expected recipient; required |
| `PAYPAL_PDT_TOKEN` | PayPal PDT identity token; required secret |
| `PAYPAL_ITEM_NUMBER` | Expected product code; default `LIFE-SECRETS` |
| `PAYPAL_ENV` | `live` or `sandbox`; default live |
| `BOOK_ENCRYPTION_KEY` | AES-256 key for the encrypted paid PDF; already generated and configured in Sites |
| `DOWNLOAD_SIGNING_KEY` | Signing key; already generated and configured in Sites |
| `RESEND_API_KEY` | Optional email provider key |
| `EMAIL_FROM` | Optional sender on a verified Resend domain |

The paid PDF is committed only as AES-GCM ciphertext (`src/encrypted-book.json`). Its encryption key lives in Sites secrets. **Do not replace it with a new random key without re-encrypting the book.** Never put the complete plaintext PDF in `public/` or a public GitHub release.

## Email behavior and limits

Email is optional. Without email settings, verified downloads still work once PayPal is connected. The receipt uses only the email in PayPal's verified notification, never a browser-supplied recipient. Resend's idempotency key is the PayPal transaction ID, with deterministic email content and a link expiring seven days after payment. Provider idempotency is time-limited (currently 24 hours); notifications retried outside that window may send another receipt. There is no persistent orders database or permanent email deduplication in this version.

Downloads re-check PayPal's returned payment status, but this is not a dedicated refund/reversal ledger and cannot guarantee immediate revocation if PayPal's PDT response is stale. A future durable order ledger and modern webhooks can add that behavior. No payment card details are stored.

## Development

Requires Node.js 22 or newer. No third-party runtime packages.

```sh
npm test
npm run build
node --check dist/server/index.js
```

Build output is a Cloudflare Worker ES module in `dist/server/index.js` with the hosting manifest in `dist/.openai/hosting.json`. The public HTML, free PDF sample and encrypted paid PDF are embedded in that module. The supported Sites build output replaces the previous static deployment.

The GitHub repository stores source; the existing Sites repository remains the deployment source. Push the exact same commit to both before saving/deploying a Sites version. Package only the contents of `dist/`, including its manifest. Preserve the existing public audience and Site project ID.

## Verification performed

Automated tests cover exact price/currency/product/recipient, incomplete/refunded/reversed/test payments, failed PayPal verification, duplicate fields, transaction mismatch, signature tampering, expiration, wrong encryption keys, forged redirect flags, direct paid-file requests, origin checks, genuine PDF decryption, email destination and retry behavior. PayPal and Resend are mocked: real checkout and email delivery still require merchant credentials and an end-to-end test.

## Official references

- [PayPal payment links and IPN/PDT support](https://www.paypal.com/us/cshelp/article/paypal-pay-links-and-buttons-troubleshooting-tips-help1137)
- [Enable PDT](https://www.paypal.com/c2/cshelp/article/how-do-i-enable-payment-data-transfer-pdt-token-help542?locale.x=en_C2)
- [PayPal PDT samples](https://github.com/paypal/pdt-code-samples)
- [PayPal IPN samples](https://github.com/paypal/ipn-code-samples)
- [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
