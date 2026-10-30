// Capture real screens against an isolated fictional dataset. Never starts the live desktop database.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const puppeteer = require('puppeteer-core');
const { fixture, root } = require('../tests/fixture');
const demo = require('../examples/demo-data');
function browserPath() {
  if (process.env.BROWSER_PATH) return process.env.BROWSER_PATH;
  const candidates = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
  const edge = 'C:/Program Files (x86)/Microsoft/EdgeCore';
  if (fs.existsSync(edge)) for (const version of fs.readdirSync(edge).reverse()) candidates.push(path.join(edge, version, 'msedge.exe'));
  const found = candidates.find(candidate => fs.existsSync(candidate));
  if (!found) throw new Error('Set BROWSER_PATH to an installed Chrome/Edge executable');
  return found;
}
(async () => {
  assert.equal(demo.demoData, true, 'Screenshots must use the fictional demo dataset');
  const env = await fixture(demo);
  let browser;
  const directory = path.join(root, 'docs', 'screenshots');
  fs.mkdirSync(directory, { recursive: true });
  const errors = [];
  const captures = [];
  try {
    browser = await puppeteer.launch({ executablePath: browserPath(), headless: true });
    async function capture(name, theme, action) {
      const page = await browser.newPage();
      await page.setViewport(name === '03-partner-directory' ? { width: 1920, height: 1200, deviceScaleFactor: 1 } : { width: 1600, height: 1000, deviceScaleFactor: 1.25 });
      page.on('pageerror', error => errors.push(name + ': ' + error.message));
      await page.evaluateOnNewDocument(theme => { localStorage.setItem('tradeflow_theme', theme); localStorage.setItem('tradeflow_role_mode', 'owner'); }, theme);
      await page.goto(env.base, { waitUntil: 'networkidle2' });
      await page.waitForFunction(() => window.app && app.data.orders.length === 8);
      await action(page);
      await page.evaluate(async () => { await document.fonts.ready; document.querySelectorAll('#toast-container > *').forEach(element => element.remove()); });
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
      await new Promise(resolve => setTimeout(resolve, 250));
      const fragments = await page.evaluate(() => document.body.innerText.match(/<\/?(?:div|span|td|tr)\b[^\n]*/g) || []);
      assert.deepEqual(fragments, [], name + ' contains escaped markup');
      await page.screenshot({ path: path.join(directory, name + '.png') });
      captures.push(name);
      await page.close();
      console.log('Captured ' + name);
    }
    const tab = name => async page => page.evaluate(name => document.querySelector('[data-sidebar-tab="' + name + '"]').click(), name);
    await capture('01-orders-pipeline', 'dark', tab('orders'));
    await capture('02-finance-cockpit', 'dark', tab('finance'));
    await capture('03-partner-directory', 'light', tab('manufacturers'));
    await capture('04-partner-workspace', 'dark', async page => page.evaluate(() => app.navigateToContact('MFG-01')));
    await capture('05-invoice-studio', 'dark', async page => page.evaluate(() => app.openInvoiceStudioModal('ORD-3001')));
    await capture('06-profit-calculator', 'light', async page => page.evaluate(() => {
      app.openProfitCalculatorModal('PRD-01'); app.setCalcMode('simple');
      app.simpleCalcData = { name: 'Classic Mango Pickle', packSize: '500g', casePack: 24, cases: 100, mfgPrice: 48, gstRate: 12, transportPct: 5, labelCost: 1.5, profitPct: 20, marketeerPct: 30, mrp: 120 };
      app.syncSimpleInputs(); app.updateProfitCalculator();
    }));
    await capture('07-daily-diary', 'dark', async page => page.evaluate(() => app.openDailyDiaryWorkspaceTab('2026-10-30')));
    const phone = await browser.newPage();
    phone.on('pageerror', error => errors.push('08-mobile-capture: ' + error.message));
    await phone.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await phone.goto(env.base + '/mobile-snap?session=DEMO-PREVIEW', { waitUntil: 'networkidle2' });
    await phone.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 1080;
      const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#047857'; context.fillRect(0, 0, 900, 160); context.fillStyle = '#ffffff'; context.font = 'bold 44px Arial'; context.fillText('TRADEFLOW DEMO', 60, 98);
      context.fillStyle = '#0f172a'; context.font = 'bold 38px Arial'; context.fillText('PAYMENT RECEIPT', 60, 250);
      context.font = '28px Arial';
      [['Status', 'Successful'], ['Date', '30 October 2026'], ['Amount', 'INR 40,000.00'], ['Party', 'Maple Grove Markets'], ['Reference', 'DEMO-UTR-2000']].forEach(([label, value], index) => { context.fillStyle = '#64748b'; context.fillText(label, 60, 345 + index * 105); context.fillStyle = '#0f172a'; context.fillText(value, 60, 385 + index * 105); });
      context.fillStyle = '#b45309'; context.font = 'bold 24px Arial'; context.fillText('SAMPLE — NOT VALID PAYMENT PROOF', 60, 970);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      processSelectedFile(new File([blob], 'demo-payment-receipt.png', { type: 'image/png' }));
      await document.fonts.ready;
    });
    await new Promise(resolve => setTimeout(resolve, 400));
    await phone.screenshot({ path: path.join(directory, '08-mobile-capture.png') });
    captures.push('08-mobile-capture');
    await phone.close();
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(root, 'docs', 'verification', 'screenshots.json'), JSON.stringify({ captured: '2026-10-30', dataset: 'Fictional demo data only', screenshots: captures, pageErrors: errors }, null, 2));
    console.log('All ' + captures.length + ' screenshots verified.');
  } finally { if (browser) await browser.close(); await env.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
