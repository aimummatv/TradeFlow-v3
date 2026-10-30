# Security and operating scope

TradeFlow 3 is a local, single-user Windows application. Desktop endpoints accept loopback clients; phones can access limited capture resources and upload using pairing tokens. Host/origin checks, bounded JSON requests, file-root containment, HTML escaping and sanitized rich messages are implemented in the source.

Owner/Operator is a screen-visibility preference, not a server-enforced authorization role. There is no account login or separation between users sharing a Windows account. Public hosting, reverse-proxy access and shared-user deployment require an authentication and authorization design before use.

## Keep private data local

- The entire `data/` directory is ignored, including SQLite, workbooks, documents, backup files and pairing tokens.
- `node_modules/`, `rapidocr/.venv/` and environment files are excluded.
- The committed `examples/demo-data.js` is fictional. On a fresh start it is copied into runtime storage and is never updated by application saves.
- Screenshots are captured from an isolated instance of that fictional dataset. Do not add screenshots of real accounts, banking records, credentials or payment slips.
- Cloud provider credentials should be configured locally and never committed.

To revoke saved phone shortcuts, stop the server, delete `data/.mobile-pairing.json`, restart and pair again. Guest pairing expires after 20 minutes. Back up the complete data directory externally; record snapshots alone do not copy every attachment.

## Verification

The retained npm and Python audit reports are point-in-time results from 30 October 2026. They reported no known package vulnerabilities in the reviewed dependency sets. This is not proof of absence of vulnerabilities. Re-run scans when dependencies change; inspect [verification notes](docs/VERIFICATION.md) for coverage and limits.

## Reporting a concern

Share security concerns privately with the repository owner. Include a minimal reproduction using fictional records. Keep credentials, real payment slips and business databases out of reports. Do not publish an exploitable issue or private data in a public issue.
