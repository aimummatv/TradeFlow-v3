const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { DatabaseSync } = require('node:sqlite');
const { fixture, seed, root } = require('./fixture');
const SyncManager = require('../sync_manager');
const BackupManager = require('../backup_manager');
const { assertWithin, createGuard } = require('../security');
let env;
before(async () => { env = await fixture(); });
after(async () => { if (env) await env.close(); });
async function post(route, value) {
  const response = await fetch(env.base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  return { status: response.status, data: await response.json() };
}
test('security: backend, dependency, source and database files are private', async () => {
  for (const route of ['/server.js', '/security.js', '/package.json', '/package-lock.json', '/.git/config', '/data/tradeflow.db', '/data/.mobile-pairing.json', '/data/backups/manifest.json', '/tests/release.test.js', '/rapidocr/requirements.txt']) assert.equal((await fetch(env.base + route)).status, 403, route);
});
test('security: hostile website origins and DNS rebinding hosts are rejected', async () => {
  for (const headers of [{ Origin: 'https://evil.example' }, { Origin: 'null' }, { Host: 'evil.example:' + env.port }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const status = await new Promise((resolve, reject) => { const req = http.get(env.base + '/api/data', { headers }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); });
    assert.equal(status, 403, JSON.stringify(headers));
  }
  const response = await fetch(env.base + '/api/data');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});
test('security: same-origin requests remain usable', async () => {
  assert.equal((await fetch(env.base + '/api/data', { headers: { Origin: env.base } })).status, 200);
});
test('security: malformed paths do not crash the server', async () => {
  assert.equal((await fetch(env.base + '/%E0%A4%A')).status, 400);
  assert.equal((await fetch(env.base + '/data/%2e%2e%5cserver.js')).status, 403);
  assert.equal((await fetch(env.base + '/api/sync/status')).status, 200);
});
test('security: invalid JSON, primitive roots, and unsafe object keys are rejected', async () => {
  for (const body of ['{', 'null', '[]', '"hello"', '{"__proto__":{"polluted":true}}']) {
    const response = await fetch(env.base + '/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(response.status, 400, body);
  }
  assert.equal({}.polluted, undefined);
});
test('security: form-style requests are rejected', async () => {
  const response = await fetch(env.base + '/api/data', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
  assert.equal(response.status, 415);
});
test('security: excessive declared request size is rejected', async () => {
  const status = await new Promise((resolve, reject) => {
    const request = http.request(env.base + '/api/data', { method: 'POST', headers: { 'Content-Length': 51 * 1024 * 1024 } }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject); request.end();
  });
  assert.equal(status, 413);
});
test('security: arbitrary file previews and OCR disk reads are blocked', async () => {
  const response = await fetch(env.base + '/api/documents/preview?path=' + encodeURIComponent(path.join(root, 'server.js')));
  assert.equal(response.status, 404);
  const scan = await post('/api/ai/test-scan', { fileData: path.join(root, 'server.js') });
  assert(!JSON.stringify(scan.data).includes('const http = require'));
});
test('security: Excel preview traversal and native folder traversal fail safely', async () => {
  for (const [route, value] of [['/api/vault/excel-preview', { filePath: '../../package.json' }], ['/api/open-folder', { filePath: path.join(root, 'server.js') }]]) {
    const response = await post(route, value);
    assert.equal(response.data.success, route.includes('open-folder') ? undefined : false);
    assert(response.status >= 400);
  }
});
test('security: project sibling-prefix paths cannot escape the data root', () => {
  const dataRoot = path.join(env.directory, 'data');
  assert.throws(() => assertWithin(dataRoot, dataRoot + '-outside/file.pdf'));
  assert.throws(() => assertWithin(dataRoot, path.join(dataRoot, '..', 'server.js')));
});
test('security: unpaired and predictable mobile sessions cannot upload', async () => {
  for (const sessionId of [undefined, 'PERMANENT', 'DIRECT', 'DEV-1234', 'SNAP-1234']) assert.equal((await post('/api/mobile-snap/upload', { sessionId, fileData: 'data:image/png;base64,aGVsbG8=', fileName: 'test.png' })).status, 403);
});
test('security: paired phone upload and session polling work', async () => {
  const session = await post('/api/mobile-snap/session', {});
  assert.match(session.data.sessionId, /^SNAP-[a-f0-9]{48}$/);
  assert(new URL(session.data.permanentUrl).searchParams.get('session').length > 60);
  const upload = await post('/api/mobile-snap/upload', { sessionId: session.data.sessionId, fileData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRXsAAAAASUVORK5CYII=', fileName: 'test.png' });
  assert.equal(upload.status, 200); assert.equal(upload.data.success, true);
  assert.equal((await fetch(env.base + upload.data.fileUrl)).status, 200);
  const status = await (await fetch(env.base + '/api/mobile-snap/status?session=' + session.data.sessionId)).json();
  assert.equal(status.session.status, 'uploaded');
});
test('security: remote clients are restricted to capture resources', async () => {
  const guard = createGuard(env.directory, env.port);
  for (const route of ['/api/data', '/', '/data/mock-data.js', '/api/sync/events']) {
    let result;
    const response = { setHeader() {}, writeHead(status) { result = status; }, end() {} };
    await guard({ headers: { host: 'localhost:' + env.port }, socket: { remoteAddress: '192.168.1.9' }, method: 'GET', url: route }, response, () => { throw new Error('Remote handler must not run'); });
    assert.equal(result, 403, route);
  }
});
test('security: executable document uploads are rejected', async () => {
  const result = await post('/api/documents/upload', { fileName: 'attack.html', fileData: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' });
  assert.equal(result.data.success, undefined); assert(result.status >= 400);
});
test('full-state persistence saves products, settings, documents and removals', () => {
  const manager = new SyncManager(env.directory);
  try {
    const data = seed();
    data.products[0].mrp = 155; data.businessProfile.brandName = 'Changed'; data.recycleBin.push({ id: 'BIN-TEST' });
    data.documents.push({ id: 'DOC-TEST', fileName: 'test.pdf', orderId: 'ORD-TEST' });
    data.customPreference = 'preserved';
    manager.saveData(data);
    let saved = manager.loadData();
    assert.equal(saved.products[0].mrp, 155); assert.equal(saved.businessProfile.brandName, 'Changed');
    assert.equal(saved.documents.length, 1); assert.equal(saved.recycleBin.length, 1); assert.equal(saved.customPreference, 'preserved');
    data.orders = []; data.payments = []; manager.saveData(data);
    saved = manager.loadData(); assert.equal(saved.orders.length, 0); assert.equal(saved.payments.length, 0);
    assert.equal(manager.dbManager.isSeeded(), true);
    manager.saveData(seed());
  } finally { manager.dbManager.db.close(); }
});
test('fresh checkout preserves its immutable example when live records change', () => {
  const directory = fs.mkdtempSync(path.join(env.directory, 'example-init-'));
  let manager;
  try {
    fs.mkdirSync(path.join(directory, 'examples'));
    const examplePath = path.join(directory, 'examples', 'demo-data.js');
    const example = 'module.exports = ' + JSON.stringify(seed()) + ';';
    fs.writeFileSync(examplePath, example);
    manager = new SyncManager(directory);
    assert.equal(manager.loadData().orders.length, 1);
    const changed = manager.loadData(); changed.businessProfile.brandName = 'Private Business Name';
    manager.saveData(changed);
    assert.equal(fs.readFileSync(examplePath, 'utf8'), example);
    assert(fs.readFileSync(path.join(directory, 'data', 'mock-data.js'), 'utf8').includes('Private Business Name'));
  } finally {
    if (manager) manager.dbManager.db.close();
    assert(directory.startsWith(env.directory + path.sep));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test('invalid or duplicate snapshot IDs do not partially overwrite the database', () => {
  const manager = new SyncManager(env.directory);
  try {
    const original = manager.loadData(); const invalid = seed(); invalid.contacts.push(invalid.contacts[0]);
    assert.throws(() => manager.saveData(invalid), /duplicate/i);
    assert.deepEqual(manager.loadData(), original);
    const broken = seed(); broken.orders[0].totalInvoiceAmount = 'not-a-number';
    assert.throws(() => manager.saveData(broken));
    assert.deepEqual(manager.loadData(), original);
  } finally { manager.dbManager.db.close(); }
});
test('unchanged snapshots do not flood the activity log', () => {
  const manager = new SyncManager(env.directory);
  try {
    const original = manager.loadData(); const before = manager.dbManager.db.prepare('SELECT COUNT(*) AS count FROM activity_log').get().count;
    manager.saveData(original); manager.saveData(original);
    assert.equal(manager.dbManager.db.prepare('SELECT COUNT(*) AS count FROM activity_log').get().count, before);
  } finally { manager.dbManager.db.close(); }
});
test('activity rollback restores the actual previous order', () => {
  const manager = new SyncManager(env.directory);
  try {
    const original = manager.dbManager.getOrder('ORD-TEST');
    manager.dbManager.saveOrder({ ...original, totalInvoiceAmount: 990 }, 'Release Test');
    const entry = manager.dbManager.getActivityLogs(10, 'ORDER', 'ORD-TEST').find(x => x.newState?.totalInvoiceAmount === 990);
    assert.equal(manager.dbManager.rollbackChange(entry.id, 'Release Test').success, true);
    assert.equal(manager.dbManager.getOrder('ORD-TEST').totalInvoiceAmount, original.totalInvoiceAmount);
  } finally { manager.dbManager.db.close(); }
});
test('WAL backup snapshots include the latest committed data and unique IDs', () => {
  const manager = new SyncManager(env.directory);
  try {
    const data = seed(); data.products[0].mrp = 321; manager.saveData(data);
    manager.dbManager.registerPaymentSlip({ utr: 'ORIGINAL-REGISTRY-UTR', orderId: 'ORD-TEST' });
    const first = manager.backupManager.createBackup('same'); const second = manager.backupManager.createBackup('same');
    assert(first.success && second.success); assert.notEqual(first.backup.id, second.backup.id);
    const db = new DatabaseSync(path.join(manager.backupManager.backupsDir, first.backup.sqliteFile), { readOnly: true });
    try { assert.equal(db.prepare('SELECT mrp FROM products WHERE id = ?').get('SKU-TEST').mrp, 321); assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok'); } finally { db.close(); }
    const changed = seed(); changed.products[0].mrp = 999; manager.saveData(changed);
    manager.dbManager.registerPaymentSlip({ utr: 'LATER-REGISTRY-UTR', orderId: 'ORD-TEST' });
    assert(manager.backupManager.restoreBackup(first.backup.id, manager).success);
    assert.equal(manager.loadData().products[0].mrp, 321);
    assert.equal(manager.dbManager.checkDuplicatePaymentSlip({ utr: 'ORIGINAL-REGISTRY-UTR' }).isDuplicate, true);
    assert.equal(manager.dbManager.checkDuplicatePaymentSlip({ utr: 'LATER-REGISTRY-UTR' }).isDuplicate, false);
    manager.saveData(seed());
  } finally { manager.dbManager.db.close(); }
});
test('restore reports database errors instead of false success', () => {
  const backup = new BackupManager(env.directory); const snapshot = backup.createBackup('restore-error');
  const result = backup.restoreBackup(snapshot.backup.id, { dbManager: { migrateFromData() { throw new Error('Simulated database failure'); } } });
  assert.equal(result.success, false); assert.match(result.error, /Simulated database failure/);
});
test('Excel export, preview, and import preserve a field edit', async () => {
  const manager = new SyncManager(env.directory);
  try {
    assert(manager.exportToExcel().success);
    const XLSX = require('xlsx'); const workbook = XLSX.readFile(manager.excelPath);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Orders_Master); rows[0]['Urgent Alert'] = 'RELEASE-ROUNDTRIP';
    workbook.Sheets.Orders_Master = XLSX.utils.json_to_sheet(rows); XLSX.writeFile(workbook, manager.excelPath);
    assert(manager.importFromExcel().success);
    assert.equal(manager.loadData().orders[0].urgentAlert, 'RELEASE-ROUNDTRIP');
    const preview = await post('/api/vault/excel-preview', { filePath: 'data/TradeFlow_Master_Database.xlsx' });
    assert.equal(preview.status, 200); assert(preview.data.sheets.Orders_Master.length);
  } finally { manager.dbManager.db.close(); }
});
test('security: every PDF.js call disables font evaluation', () => {
  for (const file of ['js/app.js', 'js/smart-fill.js']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of source.matchAll(/pdfjsLib\.getDocument\(([^\n]+)/g)) assert(match[1].includes('isEvalSupported: false'), file);
  }
});
test('security: launchers never kill a process to take over its port', () => {
  for (const file of ['server.js', 'start.server.bat']) assert(!/taskkill|Stop-Process|exec\(`/i.test(fs.readFileSync(path.join(root, file), 'utf8')), file);
});
