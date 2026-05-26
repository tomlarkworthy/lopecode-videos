import { chromium } from 'playwright';

const NOTEBOOK_PATH =
  '/Users/tom.larkworthy/dev/lopecode-dev/lopebooks/notebooks/@tomlarkworthy_lopecode-newsletter-001.html';
const TWO_PANE =
  '#view=R100(@tomlarkworthy/lopecode-newsletter-001,S50(@tomlarkworthy/lopecode-newsletter-001/sample.pdf))';
const URL = `file://${NOTEBOOK_PATH}${TWO_PANE}`;

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4000);

// Inspect the PDF iframe + rewrite its src with Chrome PDF-viewer fragment
// params to hide the toolbar / thumbnail sidebar and fit the whole page.
const before = await page.evaluate(() => {
  const ifr = Array.from(document.querySelectorAll('iframe')).find((f) =>
    f.src.startsWith('blob:'),
  ) as HTMLIFrameElement | undefined;
  return ifr ? { src: ifr.src } : null;
});
console.log('pdf iframe before:', JSON.stringify(before));

await page.screenshot({ path: '/tmp/pdf-params-before.png' });

await page.evaluate(async () => {
  const ifr = Array.from(document.querySelectorAll('iframe')).find((f) =>
    f.src.startsWith('blob:'),
  ) as HTMLIFrameElement | undefined;
  if (!ifr) return;
  const base = ifr.src.split('#')[0];
  // Force a full reload so the PDF viewer re-initializes WITH the fragment
  // params (a fragment-only change on an already-loaded iframe is a no-op).
  ifr.src = 'about:blank';
  await new Promise((r) => setTimeout(r, 200));
  ifr.src = `${base}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`;
});
await page.waitForTimeout(3000);
await page.screenshot({ path: '/tmp/pdf-params-after.png' });
console.log('saved /tmp/pdf-params-{before,after}.png');

await browser.close();
