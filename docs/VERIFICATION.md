# Verification

Reviewed locally on Windows using Node 24, installed Microsoft Edge and Python 3.12. The public-facing example and screenshots contain fictional data only.

| Command / evidence | Coverage |
| --- | --- |
| `npm test` | Private-file blocking, hostile origins/hosts, malformed input, bounded bodies, file-root escape checks, paired uploads, persistence, rollback, backup/restore and Excel round trips. |
| `npm run test:browser` | Main screens, actual calculator totals, PDF generation/loading/rendering, markup/quoted-name handling, local QR generation and the mobile page. |
| `npm run test:ocr` | Actual OCR of generated images/PDFs, a missing file and the PDF page limit. Requires the rebuilt OCR environment. |
| `npm run screenshots` | Eight real application captures using an isolated fictional dataset, with page-error and escaped-markup checks. |
| `release-npm-audit.json` | Zero known package vulnerabilities in the full reviewed Node/browser/development dependency set on 30 October 2026. |
| `release-python-audit.json` | Zero known package vulnerabilities in the reviewed installed OCR environment on 30 October 2026. |

Tests create temporary fixtures and do not operate on the local business database. The committed example is separate from runtime data, and the regression suite checks that application saves leave it unchanged.

Scans are point-in-time observations, not guarantees. Cloud AI providers, WhatsApp delivery, actual phone cameras, native Excel editing, Windows firewall prompts and printer hardware require manual end-to-end acceptance. Statutory compliance, every financial edge case and multi-window editing are not certified by these checks.

Screenshots and current validation summaries are retained in `screenshots/` and `verification/`. Raw live-data screenshots and machine-specific test logs are excluded.
