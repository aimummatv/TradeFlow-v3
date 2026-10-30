# Third-party notices

Application source remains proprietary to its existing owner. Third-party software retains its original licenses. Node versions/integrity values are in `package-lock.json`; Python versions are in `rapidocr/requirements-lock.txt`.

| Component | Version |
| --- | --- |
| SheetJS CE, official tarball | 0.20.3 |
| Mozilla PDF.js | 6.4.299 |
| html2pdf.js | 0.14.0 |
| Tailwind standalone runtime | 3.4.17 |
| Lucide | 0.468.0 |
| DOMPurify | 3.4.17 |
| qrcode-generator | 2.0.4 |
| Puppeteer Core, tests only | 25.16.0 |
| esbuild, vendor build only | 0.28.2 |

License copies are under `vendor/licenses/` where supplied; html2pdf's bundled license notice is retained. OCR packages include distribution metadata/licenses. `npm run vendor:build` reproduces npm-sourced assets after `npm ci`. Tailwind was saved from `https://cdn.tailwindcss.com/3.4.17`; its exact artifact hash is in the manifest.
