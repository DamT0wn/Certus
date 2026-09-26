const { chromium } = require(process.env.PLAYWRIGHT_PATH || '../client/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const root = path.resolve(__dirname, '..');
  const webBase = process.env.WEB_BASE_URL || 'http://127.0.0.1:5173';
  const out = path.join(root, 'tmp/qa');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const errors = [];
    const signInRequests = [];
    const apiRequests = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('request', request => {
      if (request.url().includes('/api/demo/session')) signInRequests.push(request.url());
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
    });
    await page.goto(`${webBase}/`);
    await page.getByRole('heading', { name: 'Mock sign-in for this demo' }).waitFor();
    const intakeAria = await page.locator('body').ariaSnapshot();
    assert.match(intakeAria, /heading "Mock sign-in for this demo"/);
    assert.match(intakeAria, /button "Continue with mock sign-in"/);
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({ path: path.join(out, `intake-${width}.png`), fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Intake overflow at ${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Continue with mock sign-in' }).click();
    const token = await page.evaluate(() => sessionStorage.getItem('certus_demo_session'));
    assert.match(token || '', /^[a-f0-9]{24}$/);
    assert.equal(signInRequests.length, 0, 'Mock sign-in must not depend on the API');
    await page.getByRole('button', { name: 'Load Example PDF' }).click();
    await page.waitForURL(/\/document\/[a-f0-9]+$/, { timeout: 120000 });
    await page.getByText('Evidence Feed', { exact: true }).waitFor();
    const id = page.url().split('/').pop();
    const doc = await page.evaluate(documentId => JSON.parse(sessionStorage.getItem(`certus_mock_document_${documentId}`)), id);
    const parsedText = doc.document.ocrPages.map(pageData => pageData.text).join('\n\n');
    assert(parsedText.includes('$7,500'));
    assert(!parsedText.includes('Sarah Jenkins'));
    assert(doc.facts.length > 0);
    assert(doc.facts.every(f => f.sourcePage >= 1 && f.sourcePage <= 2));
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const tab of width < 1024 ? ['Evidence', 'Document', 'Proof Intel'] : ['Desktop']) {
        if (tab !== 'Desktop') await page.getByRole('button', { name: tab, exact: true }).click();
        await page.screenshot({ path: path.join(out, `analysis-${width}-${tab.replaceAll(' ', '-')}.png`), fullPage: true });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Analysis overflow at ${width}: ${tab}`);
      }
    }
    await page.getByRole('button', { name: /Early Termination/ }).click();
    await page.getByText(/The scenario is directly affected by this clause:/).first().waitFor();
    await page.locator('input[placeholder="Ask Certus or probe a legal clause..."]').fill('What is the fee?');
    await page.getByRole('button', { name: 'Submit Inquiry' }).click();
    await page.getByText('What is the fee?', { exact: true }).waitFor();
    await page.getByText(/Cedar Studio shall pay a fixed fee of \$7,500/).last().waitFor();
    await page.getByRole('button', { name: /Breach of Contract/ }).click();
    await page.getByText(/The scenario is directly affected by this clause:|No clause in the uploaded document directly addresses this scenario/).first().waitFor();
    await page.getByRole('link', { name: /Generate Brief/ }).click();
    await page.getByRole('heading', { name: 'Legal Document Audit & Citation Brief' }).waitFor();
    const briefAria = await page.locator('body').ariaSnapshot();
    assert.match(briefAria, /heading "Legal Document Audit & Citation Brief"/);
    assert.match(briefAria, /button "Copy Memo"/);
    const hashText = await page.getByText(/Content SHA-256:/).textContent();
    const contentHash = hashText.match(/[a-f0-9]{64}/)?.[0];
    assert.match(contentHash || '', /^[a-f0-9]{64}$/);
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({ path: path.join(out, `brief-${width}.png`), fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Brief overflow at ${width}`);
    }
    await page.getByRole('button', { name: 'Copy Memo', exact: true }).click();
    await page.getByRole('button', { name: 'Copied Markdown' }).waitFor();
    assert((await page.evaluate(() => navigator.clipboard.readText())).includes(contentHash));
    await page.pdf({ path: path.join(out, 'exported-brief.pdf'), format: 'A4', printBackground: true });
    await page.reload();
    await page.getByRole('heading', { name: 'Legal Document Audit & Citation Brief' }).waitFor();
    const reloadedHashText = await page.getByText(/Content SHA-256:/).textContent();
    assert(reloadedHashText.includes(contentHash), 'Brief content hash changed after reload');
    assert.equal(apiRequests.length, 0, `Self-contained mock made API requests:\n${apiRequests.join('\n')}`);
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(JSON.stringify({ result: 'passed', mode: doc.document.mode, pages: doc.document.ocrPages.length, claims: doc.facts.length, widths: [375, 768, 1440], checks: ['intake ARIA tree', 'mock sign-in', 'local PDF parsing', 'local extraction', 'page citations', 'local scenarios', 'local chat', 'brief ARIA tree', 'stable SHA-256', 'clipboard export', 'PDF export', 'zero API requests'], artifacts: out }));
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
