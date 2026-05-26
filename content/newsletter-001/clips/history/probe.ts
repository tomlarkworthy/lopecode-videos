import { chromium } from 'playwright';

const NOTEBOOK_PATH =
  '/Users/tom.larkworthy/dev/lopecode-dev/lopebooks/notebooks/@tomlarkworthy_lopecode-newsletter-001.html';
const HASH = '#view=R100(@tomlarkworthy/lopecode-newsletter-001,S50(@tomlarkworthy/local-change-history))';
const URL = `file://${NOTEBOOK_PATH}${HASH}`;

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(5000);

const info = await page.evaluate(() => {
  const h1 = Array.from(document.querySelectorAll('h1')).find((x) =>
    /^local change history$/i.test((x.textContent ?? '').trim()),
  ) as HTMLElement | null;
  if (!h1) return { error: 'no h1' };
  // Walk up and dump ancestor classes
  const chain: any[] = [];
  let n: HTMLElement | null = h1;
  while (n && chain.length < 8) {
    chain.push({
      tag: n.tagName,
      cls: (n.className ?? '').toString().slice(0, 80),
      hasEditableMd: n.classList?.contains('lope-editable-md'),
    });
    n = n.parentElement;
  }
  // Look for any .hotbar elements near the h1
  const r = h1.getBoundingClientRect();
  const hits = Array.from(document.querySelectorAll('.hotbar')).map((e) => {
    const er = e.getBoundingClientRect();
    return {
      text: (e.textContent ?? '').trim(),
      x: Math.round(er.x), y: Math.round(er.y),
      dy: Math.round(er.y - r.y),
    };
  }).filter((h) => Math.abs(h.dy) < 200 && h.x > 600).slice(0, 5);
  return { h1Pos: { x: Math.round(r.x), y: Math.round(r.y) }, chain, nearbyHotbars: hits };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
