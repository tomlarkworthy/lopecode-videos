import { captureStills, pause } from '../../../../src/capture.ts';

const NOTEBOOK_PATH =
  '/Users/tom.larkworthy/dev/lopecode-dev/lopebooks/notebooks/@tomlarkworthy_lopecode-newsletter-001.html';
const HASH =
  '#view=R100(@tomlarkworthy/lopecode-newsletter-001,S50(@tomlarkworthy/themes))';
const URL = `file://${NOTEBOOK_PATH}${HASH}`;

await captureStills(
  {
    url: URL,
    outDir: import.meta.dir,
    videoName: 'themes',
    warmupMs: 4000,
    // Each still lingers this long in the final slideshow.
    stillDurationSec: 0.4,
  },
  async (page, ctrl) => {
    // Frame both panes + reset to the first theme.
    const themeNames = await page.evaluate(() => {
      // Close any cell editors left open.
      Array.from(document.querySelectorAll('.hotbar'))
        .filter((e) => /\bclose\b/.test((e.textContent ?? '').trim()))
        .forEach((e) => (e as HTMLElement).click());

      const select = document.querySelectorAll('select')[0];
      const names = Array.from(select.options).map((o) => o.textContent?.trim() ?? '');

      const lh = Array.from(document.querySelectorAll('h3')).find((x) =>
        /reactive theming/i.test(x.textContent ?? ''),
      );
      lh?.scrollIntoView({ block: 'start' });
      const panes = Array.from(document.querySelectorAll('.lopecode-visualizer'));
      const themesPane = panes[1];
      const colors = Array.from(themesPane.querySelectorAll('h4')).find((h) =>
        /colors/i.test(h.textContent ?? ''),
      );
      colors?.scrollIntoView({ block: 'start' });

      return names;
    });

    // Show every other theme — halves the clip length while keeping the full
    // light→dark spread (vs. just the alphabetical first half).
    const indices = themeNames.map((_, i) => i).filter((i) => i % 2 === 0);

    // For each theme: dispatch, wait long enough for CSS fetch + paint to
    // fully settle, then grab the still. No timing pressure during capture —
    // the final video is built from PNGs.
    for (const i of indices) {
      await page.evaluate((idx) => {
        const select = document.querySelectorAll('select')[0];
        select.value = String(idx);
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }, i);
      await pause(page, 1500);
      await ctrl.takeStill();
    }
  },
);

console.log('themes clip saved →', import.meta.dir);
