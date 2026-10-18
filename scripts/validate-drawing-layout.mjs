import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(pathToFileURL(resolve('index.html')).href);
  await page.locator('#generateBtn').click();
  await page.waitForFunction(() => document.querySelectorAll('.paper').length === 2);
  await page.waitForFunction(() => document.querySelectorAll('.drawing-engine-panel .drawing-engine-item svg').length === 4);
  await page.waitForTimeout(250);

  const screen = await page.evaluate((pageErrors) => ({
    pages: [...document.querySelectorAll('.paper')].map((paper) => {
      const rect = paper.getBoundingClientRect();
      const panel = paper.querySelector('.drawing-engine-panel');
      const questions = paper.querySelector('.questions');
      return {
        width: rect.width, height: rect.height,
        pageScrollHeight: paper.scrollHeight, pageClientHeight: paper.clientHeight,
        panelCount: panel?.querySelectorAll('.drawing-engine-item').length || 0,
        panelTop: panel?.getBoundingClientRect().top,
        panelBottom: panel?.getBoundingClientRect().bottom,
        questionOverflow: questions ? questions.scrollHeight > questions.clientHeight + 2 : true,
        panelInsidePage: panel ? panel.getBoundingClientRect().bottom <= rect.bottom + 2 : false
      };
    }),
    ids: [...document.querySelectorAll('.drawing-engine-item svg')].map((svg) => svg.getAttribute('aria-label')),
    ca: (() => { const el = document.querySelector('.paper.c1 .current'); if (!el) return null; const r = el.getBoundingClientRect(); return { width: r.width, height: r.height, gridColumn: getComputedStyle(el).gridColumn }; })(),
    pageErrors
  }), errors);
  assert.equal(screen.pages.length, 2, 'duplex worksheet must render two A4 pages');
  assert.deepEqual(screen.pages.map((p) => p.panelCount), [2, 2], 'each side must have two drawing panels');
  assert.equal(new Set(screen.ids).size, 4, 'all four drawings on the worksheet must be distinct');
  assert.ok(screen.ca && screen.ca.width > 300, 'Class 1 Current Affairs must use the full-width compact box');
  assert.ok(screen.pages.every((p) => p.panelInsidePage), 'drawing panels must stay inside A4 page bounds');
  assert.ok(screen.pages.every((p) => !p.questionOverflow), 'worksheet question grid must not overflow');
  assert.deepEqual(screen.pageErrors, [], 'browser must not report uncaught application errors');

  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(150);
  const print = await page.evaluate(() => [...document.querySelectorAll('.paper')].map((paper) => {
    const r = paper.getBoundingClientRect();
    const panel = paper.querySelector('.drawing-engine-panel')?.getBoundingClientRect();
    return { width: r.width, height: r.height, panelInsidePage: !!panel && panel.bottom <= r.bottom + 2, pageScrollHeight: paper.scrollHeight, pageClientHeight: paper.clientHeight };
  }));
  assert.equal(print.length, 2, 'print output must retain two duplex pages');
  assert.ok(print.every((p) => p.panelInsidePage), 'print-mode drawing panels must stay inside A4 bounds');
  console.log(JSON.stringify({ result: 'PASS', screen, print }, null, 2));
} finally {
  await browser.close();
}
