import { chromium } from 'playwright';

const NOTEBOOK_PATH =
  '/Users/tom.larkworthy/dev/lopecode-dev/lopebooks/notebooks/@tomlarkworthy_lopecode-newsletter-001.html';
const URL = `file://${NOTEBOOK_PATH}#view=R100(@tomlarkworthy/lopecode-newsletter-001)`;

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'load' });
await page.waitForTimeout(4000);

// Find the "Try it: sample.pdf" aside link.
const linkInfo = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('a')).filter(
    (a) =>
      /sample\.pdf/i.test(a.textContent ?? '') ||
      /sample\.pdf/i.test(a.getAttribute('href') ?? ''),
  );
  return links.map((a) => ({
    text: a.textContent?.trim(),
    href: a.getAttribute('href'),
  }));
});
console.log('PDF links:', JSON.stringify(linkInfo, null, 2));

// Scroll the link into view and screenshot the "Native browser tabs" section.
await page.evaluate(() => {
  const a = Array.from(document.querySelectorAll('a')).find((x) =>
    /sample\.pdf/i.test(x.textContent ?? ''),
  );
  // Scroll the heading "Native browser tabs" to the top for framing.
  const h = Array.from(document.querySelectorAll('h3')).find((x) =>
    /native browser tabs/i.test(x.textContent ?? ''),
  );
  (h ?? a)?.scrollIntoView({ block: 'start' });
});
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/pdf-before.png' });
console.log('saved /tmp/pdf-before.png');

// Click the link and watch the side pane open.
const clicked = await page.evaluate(() => {
  const a = Array.from(document.querySelectorAll('a')).find((x) =>
    /sample\.pdf/i.test(x.textContent ?? ''),
  ) as HTMLAnchorElement | undefined;
  if (!a) return false;
  a.click();
  return true;
});
console.log('clicked link:', clicked);
await page.waitForTimeout(3000);
await page.screenshot({ path: '/tmp/pdf-after.png' });
console.log('saved /tmp/pdf-after.png');

// Report what panes exist now.
const panes = await page.evaluate(() => {
  const ps = Array.from(document.querySelectorAll('.lopecode-visualizer, iframe, embed, object'));
  return ps.map((p) => {
    const r = p.getBoundingClientRect();
    return {
      tag: p.tagName,
      cls: (p.className ?? '').toString().slice(0, 40),
      src: (p as HTMLIFrameElement).src?.slice(-40) ?? null,
      rect: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`,
    };
  });
});
console.log('panes after:', JSON.stringify(panes, null, 2));
console.log('hash now:', await page.evaluate(() => location.hash));

await browser.close();
