const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const python = path.join(root, 'rapidocr', '.venv', 'Scripts', 'python.exe');
const result = spawnSync(python, [path.join(root, 'tests', 'test_ocr.py')], { stdio: 'inherit', windowsHide: true });
if (result.error) console.error(result.error.message);
process.exitCode = result.status === null ? 1 : result.status;
