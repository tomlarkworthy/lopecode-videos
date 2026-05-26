import { capture, pause } from '../../../../src/capture.ts';

// Self-contained CSS/SVG scene — no notebook, no network. The whole intro is
// one JS-started timeline inside intro.html; we just mark() and let it run.
const URL = `file://${import.meta.dir}/intro.html`;

// Must cover the full timeline in intro.html (last beat ~4.1s) + a hold.
const TOTAL_MS = 4700;

await capture(
  { url: URL, outDir: import.meta.dir, videoName: 'intro', warmupMs: 600 },
  async (page, ctrl) => {
    // Suppress the page's own auto-play so we control when the timeline
    // begins; the first frame is the full neon scene + disk over the screen.
    await page.addInitScript(() => {
      (window as unknown as { __captureMode: boolean }).__captureMode = true;
    });
    await page.reload({ waitUntil: 'load' });
    await pause(page, 300);

    await ctrl.mark();
    await pause(page, 120); // glimpse the presented disk, then dive straight in
    await page.evaluate(() => (window as unknown as { startIntro: () => void }).startIntro());
    await pause(page, TOTAL_MS);
  },
);

console.log('intro clip saved →', import.meta.dir);
