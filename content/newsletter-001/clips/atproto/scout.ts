import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const USER_DATA_DIR = resolve(import.meta.dir, '../../../../.auth/chrome-profile');
const NOTEBOOK_PATH =
  '/Users/tom.larkworthy/dev/lopecode-dev/lopebooks/notebooks/@tomlarkworthy_lopecode-newsletter-001.html';
const HASH = '#view=R100(@tomlarkworthy/lopecode-newsletter-001,S50(@tomlarkworthy/at-write))';
const URL = `file://${NOTEBOOK_PATH}${HASH}`;

await mkdir(USER_DATA_DIR, { recursive: true });
const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: false,
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 2,
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(8000);

// Scroll left pane to ATProto publishing section so layout matches the clip.
await page.evaluate(() => {
  const h = Array.from(document.querySelectorAll('h2, h3')).find((x) =>
    /atproto publishing/i.test(x.textContent ?? ''),
  ) as HTMLElement | null;
  if (h) {
    let n: HTMLElement | null = h;
    while (n && !n.classList?.contains('lm_content')) n = n.parentElement;
    if (n) {
      const r = h.getBoundingClientRect();
      const nr = n.getBoundingClientRect();
      n.scrollTop = n.scrollTop + (r.top - nr.top) - 8;
    }
  }
});
await page.waitForTimeout(1000);

const info = await page.evaluate(() => {
  const tiles = Array.from(document.querySelectorAll('[data-source]')).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      source: el.getAttribute('data-source'),
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      visible: r.width > 0 && r.height > 0 && r.top >= 0 && r.top <= 720,
      cursor: (el as HTMLElement).style.cursor,
      opacity: (el as HTMLElement).style.opacity,
    };
  });

  // Identity row indicators in at-write itself.
  const allSpans = Array.from(document.querySelectorAll('span'));
  const signedInMarkers = allSpans
    .filter((s) => /sign in to publish|sign in to continue|@[a-z0-9.-]+/i.test(s.textContent ?? ''))
    .map((s) => ({ text: (s.textContent ?? '').trim().slice(0, 80) }));

  const hasPublishBtn = !!document.querySelector('[data-btn="publish"]');
  const publishBtnDisabled = (document.querySelector('[data-btn="publish"]') as HTMLButtonElement | null)?.disabled;

  const hasTitleInput = !!document.querySelector('input[data-field="title"]');

  return { tiles, signedInMarkers: signedInMarkers.slice(0, 10), hasPublishBtn, publishBtnDisabled, hasTitleInput };
});

console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: import.meta.dir + '/scout-init.png', fullPage: false });
await ctx.close();
