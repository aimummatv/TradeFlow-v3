const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
(async () => {
  await esbuild.build({ entryPoints: [path.join(root, 'node_modules/pdfjs-dist/build/pdf.mjs')], outfile: path.join(root, 'lib/pdf.min.js'), bundle: true, format: 'iife', globalName: 'pdfjsLib', platform: 'browser', target: 'es2022', minify: true, legalComments: 'eof' });
  const files = {
    'pdfjs-dist/build/pdf.worker.min.mjs': 'lib/pdf.worker.min.js',
    'lucide/dist/umd/lucide.min.js': 'vendor/lucide.js',
    'html2pdf.js/dist/html2pdf.bundle.min.js': 'vendor/html2pdf.js',
    'html2pdf.js/dist/html2pdf.bundle.min.js.LICENSE.txt': 'vendor/html2pdf.LICENSE.txt',
    'dompurify/dist/purify.min.js': 'vendor/dompurify.js',
    'qrcode-generator/dist/qrcode.js': 'vendor/qrcode.js'
  };
  for (const [source, destination] of Object.entries(files)) fs.copyFileSync(path.join(root, 'node_modules', source), path.join(root, destination));
  console.log('Rebuilt pinned browser libraries. Tailwind is the pinned 3.4.17 standalone runtime.');
})().catch(error => { console.error(error); process.exitCode = 1; });
