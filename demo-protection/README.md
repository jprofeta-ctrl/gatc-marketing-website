# GATC demo protection — REVIEW ONLY

Files:
- demo-access.html — visitor information and draft evaluation agreement.
- demo-gateway-worker.js — Cloudflare Worker prototype for acceptance logging and gated access.

NOT DEPLOYED. This branch is for review only.

## Before any launch
1. Obtain California software attorney review of agreement and privacy disclosures. Confirm legal contracting entity.
2. Create private Cloudflare KV bindings DEMO_CONTENT and ACCEPTANCE_LOG and a random SESSION_SECRET (at least 32 bytes).
3. Put vetted fictional demo HTML in DEMO_CONTENT key index.html and the agreement HTML in key agreement.html.
4. Test session expiry, bypass attempts, form validation, acceptance records, mobile rendering, and data retention/deletion.
5. Disable or restrict the existing public demo URL; otherwise visitors can bypass the gateway.
6. Only after testing, change the marketing website's Try Live Demo link to the gated domain, with explicit owner approval.
7. Preserve production George's app and existing Google Workspace DNS.

This prototype does not implement rate limits, bot mitigation, full privacy compliance, or asset routing for multi-file demo bundles. Do not represent it as a production-ready security solution.