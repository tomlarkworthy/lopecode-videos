import { capture, pause } from '../../../../src/capture.ts';

// Self-contained CSS/SVG scene — no notebook, no network. The outro is the
// intro in reverse; one JS-started timeline inside outro.html. We mark() on
// the intro's final frame and let it run.
const URL = `file://${import.meta.dir}/outro.html`;

// Must cover the full timeline in outro.html (last beat — eject ends ~5.5s).
// End right as the disk settles — don't linger on the ejected (open) disk.
const TOTAL_MS = 5650;

await capture(
  { url: URL, outDir: import.meta.dir, videoName: 'outro', warmupMs: 600 },
  async (page, ctrl) => {
    // Suppress the page's own auto-play so we control when the reverse begins.
    await page.addInitScript(() => {
      (window as unknown as { __captureMode: boolean }).__captureMode = true;
    });
    await page.reload({ waitUntil: 'load' });
    await pause(page, 300);

    await ctrl.mark();
    await pause(page, 250); // hold on the "RUN NEWSLETTER-001" frame before output prints
    await page.evaluate(() => (window as unknown as { startOutro: () => void }).startOutro());
    await pause(page, TOTAL_MS);
  },
);

console.log('outro clip saved →', import.meta.dir);
