const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { fixture, root } = require('./fixture');
function browserPath() {
  if (process.env.BROWSER_PATH) return process.env.BROWSER_PATH;
  const candidates = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
  const edge = 'C:/Program Files (x86)/Microsoft/EdgeCore';
  if (fs.existsSync(edge)) for (const version of fs.readdirSync(edge).reverse()) candidates.push(path.join(edge, version, 'msedge.exe'));
  const found = candidates.find(file => fs.existsSync(file));
  if (!found) throw new Error('Set BROWSER_PATH to your Chrome or Edge executable');
  return found;
}
(async () => {
  const env = await fixture();
  let browser;
  const passed = [];
  try {
    browser = await puppeteer.launch({ executablePath: browserPath(), headless: true, defaultViewport: { width: 1440, height: 1000 } });
    const page = await browser.newPage();
    const errors = [];
    async function assertCleanTemplates() {
      const result = await page.evaluate(() => {
        const escaped = document.body.innerText.match(/<\/?(?:div|span|tr|td|button)\b[^\n]*/g) || [];
        const invalid = [];
        for (const element of document.querySelectorAll('*')) for (const attribute of element.attributes) {
          if (/^on/.test(attribute.name)) try { new Function('event', attribute.value); } catch (error) { invalid.push({ attribute: attribute.name, value: attribute.value.slice(0, 160), error: error.message }); }
        }
        return { escaped: escaped.slice(0, 8), invalid: invalid.slice(0, 8) };
      });
      assert.deepEqual(result, { escaped: [], invalid: [] });
    }
    const badLocalResponses = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(env.base) && response.status() >= 400) badLocalResponses.push(response.status() + ' ' + response.url()); });
    await page.setRequestInterception(true);
    page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(env.base)) request.abort(); else request.continue(); });
    await page.goto(env.base, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => window.app && app.data.orders.length === 1);
    const tableText = await page.$eval('#orders-table-body', el => el.innerText);
    assert(tableText.includes('INV-TEST') || tableText.includes('ORD-TEST'), JSON.stringify({ tableText, errors, badLocalResponses }));
    passed.push('Desktop starts and loads authoritative orders with external network blocked');
    for (const tab of ['payments', 'vault', 'retailers', 'manufacturers', 'marketeers', 'packaging']) {
      const found = await page.evaluate(tab => { const button = document.querySelector('[data-sidebar-tab="' + tab + '"]'); if (!button) return false; button.click(); return true; }, tab);
      if (!found) throw new Error('Missing sidebar tab: ' + tab);
      await assertCleanTemplates();
    }
    passed.push('Payments, vault, and all four partner directories open');
    await page.evaluate(() => app.openOrderDetailPage('ORD-TEST'));
    assert(await page.evaluate(() => document.body.innerText.includes('ORD-TEST')));
    passed.push('Order dossier opens');
    await page.evaluate(() => {
      app.openProfitCalculatorModal();
      app.calcMode = 'simple';
      app.simpleCalcData = { name: 'Test', mfgPrice: 4.50, gstRate: 18, transportPct: 5, labelCost: 0, profitPct: 20, marketeerPct: 30, mrp: 15, cases: 100, casePack: 72 };
      app.updateProfitCalculator();
    });
    const calculator = await page.evaluate(() => Object.fromEntries(['big-tile-our-profit', 'big-tile-landed-outflow', 'big-tile-ss-invoice'].map(id => [id, document.getElementById(id).innerText])));
    assert(calculator['big-tile-our-profit'].includes('8,035'));
    assert(calculator['big-tile-landed-outflow'].includes('40,176'));
    assert(calculator['big-tile-ss-invoice'].includes('60,264'));
    passed.push('Real calculator computes expected profit, cost and invoice totals');
    await page.evaluate(() => app.openInvoiceStudioModal('ORD-TEST'));
    passed.push('Invoice studio opens for the test order');
    await assertCleanTemplates();
    const pdfResult = await page.evaluate(async () => {
      const element = document.createElement('div'); element.textContent = 'TradeFlow PDF release verification'; document.body.appendChild(element);
      try {
        const bytes = await html2pdf().from(element).outputPdf('arraybuffer');
        const size = bytes.byteLength;
        const task = pdfjsLib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
        const pdf = await task.promise;
        const pdfPage = await pdf.getPage(1); const viewport = pdfPage.getViewport({ scale: 0.25 });
        const canvas = document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
        await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const result = { version: pdfjsLib.version, pages: pdf.numPages, bytes: size };
        await task.destroy(); return result;
      } finally { element.remove(); }
    });
    assert(pdfResult.pages >= 1 && pdfResult.bytes > 100, JSON.stringify(pdfResult));
    passed.push('Current PDF viewer generates, loads and renders a PDF with its local worker');
    await page.evaluate(() => {
      window.__tfInjection = 0;
      const attack = '<img src=x onerror="window.__tfInjection=1">';
      for (const contact of app.data.contacts) contact.name = attack;
      app.data.orders[0].retailerName = attack;
      app.renderRetailersView(); app.renderManufacturersView();
      app.navigateToContact('CNT-TEST');
      app.showToast(attack);
    });
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(await page.evaluate(() => window.__tfInjection), 0);
    await page.evaluate(() => {
      for (const contact of app.data.contacts) contact.name = 'O\'Brien & Sons "Trade"';
      app.renderRetailersView(); app.renderManufacturersView(); app.navigateToContact('CNT-TEST');
    });
    await assertCleanTemplates();
    passed.push('Imported markup stays text, and apostrophes preserve working event handlers');
    const qr = await page.evaluate(() => app.createQrDataUrl('http://localhost/pairing-test'));
    assert(qr.startsWith('data:image/'));
    passed.push('QR codes generate locally');
    const phone = await browser.newPage();
    const phoneErrors = [];
    phone.on('pageerror', error => phoneErrors.push(error.message));
    await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await phone.goto(env.base + '/mobile-snap?session=browser-test', { waitUntil: 'networkidle2' });
    assert.equal(await phone.$eval('#session-badge', el => el.innerText), 'browser-test');
    assert.deepEqual(phoneErrors, []);
    passed.push('Phone capture page renders at mobile size');
    await phone.close();
    await page.screenshot({ path: path.join(env.directory, 'desktop-smoke.png') });
    assert.deepEqual(errors, []);
    assert.deepEqual(badLocalResponses, []);
    passed.push('No JavaScript page errors or failed local resources');
    console.log(JSON.stringify({ passed: passed.length, checks: passed, calculator }, null, 2));
  } finally { if (browser) await browser.close(); await env.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
