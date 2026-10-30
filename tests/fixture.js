const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { once } = require('events');
const root = path.resolve(__dirname, '..');
function seed() {
  return {
    businessProfile: { legalName: 'Release Test Company', brandName: 'Test', stateCode: '27', gstin: '27AAIFA1234F1Z5' },
    products: [{ id: 'SKU-TEST', name: 'Test Product', mrp: 100, hsn: '2001' }],
    contacts: [{ id: 'CNT-TEST', name: 'Test Buyer', role: 'retailer', phone: '9000000000', stateCode: '27' },
      { id: 'CNT-MFG', name: 'Test Factory', role: 'manufacturer', phone: '9000000001' },
      { id: 'CNT-PKG', name: 'Test Packaging', role: 'packaging', phone: '9000000002' },
      { id: 'CNT-MKT', name: 'Test Marketeer', role: 'marketeer', phone: '9000000003' }],
    orders: [{ id: 'ORD-TEST', invoiceNumber: 'INV-TEST', retailerId: 'CNT-TEST', retailerName: 'Test Buyer', status: 'pending', date: '2026-10-30', totalInvoiceAmount: 118, customerBalanceDue: 118, items: [{ productId: 'SKU-TEST', name: 'Test Product', cases: 1, units: 1, unitRate: 100, totalAmount: 100 }] }],
    payments: [{ id: 'PAY-TEST', orderRef: 'ORD-TEST', partyName: 'Test Buyer', direction: 'received', amount: 10, date: '2026-10-30', utr: 'TEST-UTR-123' }],
    documents: [], recycleBin: []
  };
}
async function fixture(demoData = seed()) {
  const scratch = path.resolve(root, '..', '.tradeflow-tests');
  fs.mkdirSync(scratch, { recursive: true });
  const directory = fs.mkdtempSync(path.join(scratch, 'run-'));
  for (const file of ['server.js', 'security.js', 'db_manager.js', 'sync_manager.js', 'backup_manager.js', 'index.html', 'mobile_snap.html']) fs.copyFileSync(path.join(root, file), path.join(directory, file));
  for (const dir of ['js', 'css', 'lib', 'vendor']) fs.cpSync(path.join(root, dir), path.join(directory, dir), { recursive: true });
  fs.mkdirSync(path.join(directory, 'data'));
  fs.writeFileSync(path.join(directory, 'data', 'mock-data.js'), 'const INITIAL_DATA = ' + JSON.stringify(demoData).replace(/</g, '\\u003c') + '; if(typeof module !== "undefined") module.exports=INITIAL_DATA;');
  const probe = http.createServer();
  probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['server.js'], { cwd: directory, env: { ...process.env, PORT: String(port), TRADEFLOW_AI_ONLY: 'true', NODE_PATH: path.join(root, 'node_modules') }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  child.stdout.on('data', chunk => logs += chunk);
  child.stderr.on('data', chunk => logs += chunk);
  const base = 'http://127.0.0.1:' + port;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error('Fixture server stopped: ' + logs);
    try { if ((await fetch(base + '/api/sync/status')).ok) break; } catch {}
    if (attempt === 99) { child.kill(); throw new Error('Fixture startup timeout: ' + logs); }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return { directory, base, port, child, logs: () => logs, async close() {
    if (child.exitCode === null) { child.kill(); await once(child, 'exit'); }
    if (!directory.startsWith(scratch + path.sep)) throw new Error('Unsafe test cleanup path');
    fs.rmSync(directory, { recursive: true, force: true });
  } };
}
module.exports = { fixture, seed, root };
