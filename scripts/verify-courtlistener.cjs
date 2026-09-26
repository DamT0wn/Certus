// Live integration smoke test; never prints tokens or upstream error bodies.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 768, height: 1000 } });
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: '1-Click Demo Login' }).waitFor();
    await page.locator('input[type=file]').setInputFiles(path.join(__dirname, '../client/public/sample-contract.pdf'));
    await page.waitForURL(/\/document\/[a-f0-9]+$/, { timeout: 120000 });
    await page.getByRole('button', { name: 'Proof Intel', exact: true }).click();
    await page.getByText('US case-law research · CourtListener', { exact: true }).click();
    await page.getByRole('textbox', { name: 'Case-law search terms' }).fill('contract');
    const resultPromise = page.waitForResponse(r => r.url().includes('/research/cases'));
    await page.getByRole('button', { name: 'Search case law' }).click();
    const result = await resultPromise;
    const data = await result.json();
    assert.equal(result.status(), 200, data.error || 'Research request failed');
    assert(data.results.length > 0);
    await page.getByRole('link', { name: data.results[0].caseName, exact: false }).first().waitFor();
    fs.mkdirSync(path.join(__dirname, '../tmp/qa'), { recursive: true });
    await page.screenshot({ path: path.join(__dirname, '../tmp/qa/courtlistener-768.png') });
    await page.setViewportSize({ width: 375, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(__dirname, '../tmp/qa/courtlistener-375.png') });
    await page.route('**/api/research/cases*', route => route.fulfill({ status: 429, json: { error: 'CourtListener rate limit reached. Please try again later.' } }));
    await page.getByRole('button', { name: 'Search case law' }).click();
    await page.getByRole('alert').filter({ hasText: 'rate limit reached' }).waitFor();
    console.log(JSON.stringify({ liveSearch: 'passed', results: data.results.length, widths: [375, 768], errorState: 'passed' }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
