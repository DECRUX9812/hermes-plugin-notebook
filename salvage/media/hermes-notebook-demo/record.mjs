import { chromium } from 'playwright-core';
const EXE = '/home/decrux/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: 'raw', size: { width: 1920, height: 1080 } },
});
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('PAGEERR', m.text()); });
page.on('pageerror', e => console.log('PAGEERR', e.message));
await page.goto('file://' + process.cwd() + '/index.html');
await page.waitForTimeout(84000);
await ctx.close();
await browser.close();
console.log('done');
