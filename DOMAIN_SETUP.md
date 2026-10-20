# Connect oportals.com

O Portals is the website brand; Life Secrets remains the book title. The existing site remains live at https://life-secrets-guide.issawbanna.chatgpt.site until DNS verification completes.

The hosting platform has registered `oportals.com`; its state is pending DNS validation. Current nameservers are `ns49.domaincontrol.com` and `ns50.domaincontrol.com`, which indicate GoDaddy DNS.

In the DNS manager for oportals.com, set these records:

| Type | Name / Host | Value |
| --- | --- | --- |
| A | @ | 162.159.143.30 |
| A | @ | 172.66.3.26 |
| TXT | _openai-site-verification | openai-site-verification=hbkkEH10zyMgXRhAKSvRYM7n7TOlsykKOmkCUegGrAQ |
| TXT | _cf-custom-hostname | c9581a40-2839-4134-91ba-4b95b8884bb0 |

The existing apex A records observed were `3.33.251.168` and `15.197.225.128`. Replace apex web-routing A records with the two targets above when ready to move this hostname. If an apex AAAA or forwarding rule exists, inspect it and remove conflicting web routing before enabling the new site. Do not change nameservers, MX, SPF, DKIM, DMARC, or unrelated subdomain records. In particular, the existing email MX records must remain intact.

An existing service on the apex will stop receiving web traffic after the A-record change. No DNS changes were made by the assistant. `www.oportals.com` has not been registered; these records connect the bare `oportals.com` only.

After saving DNS, refresh domain status in Sites to finish validation and certificate provisioning. Only after the custom domain is active should PayPal return URLs, email download URLs, and canonical metadata be switched to it. The backend currently permits the exact original site origin and `https://oportals.com` for same-origin checkout requests, retaining strict origin checks.
