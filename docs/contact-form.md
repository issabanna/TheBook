# Testing contact form

Public form: /Testing/info/contact. Owner inbox: /Testing/contact-inbox.

The form posts directly to /Testing/api/contact. It stores questions privately in D1 and does not open the visitor's email application. Messages are not analytics events. The destination address is server configuration and never exposed in the public form.

## Activate email notifications

In the site's environment settings, add a Resend API key as RESEND_API_KEY and a sender address from a domain verified in Resend as EMAIL_FROM. CONTACT_TO is already configured privately. Publish with the updated environment. Do not put API keys in HTML or source control.

With no sender configured, submission returns “received” and says notification is pending. Questions remain accessible in the authenticated owner inbox. Once configured, the owner can send queued notifications there, up to ten at a time. Successful email status means the provider accepted it, not proof of inbox delivery.

Records expire after 30 days when the inbox or contact endpoints are used; owners can delete individual messages sooner. Rate limiting stores keyed hashes, not raw IP addresses. Reply addresses and message bodies are stored only in the private message table.

Verified locally: persistence, fixed recipient, provider acceptance/rejection, queue recovery, duplicate submissions, validation, rate limiting, escaping, expiration, deletion and owner access. Real email delivery remains unverified until sender credentials are configured. The existing public root homepage is unchanged.
