import { capture, pause } from '../../../../src/capture.ts';

const NOTEBOOK_PATH =
  '/Users/tom.larkworthy/dev/lopecode-dev/lopebooks/notebooks/@tomlarkworthy_lopecode-newsletter-001.html';
// Boot the newsletter; we scroll to the "CMD + K Command bar" section so the
// prose explaining the feature is on screen when the palette opens.
const HASH = '#view=R100(@tomlarkworthy/lopecode-newsletter-001)';
const URL = `file://${NOTEBOOK_PATH}${HASH}`;

await capture(
  {
    url: URL,
    outDir: import.meta.dir,
    videoName: 'cmd-k',
    warmupMs: 3500,
  },
  async (page, ctrl) => {
    // Setup (before recording): scroll the CMD+K section to the top, close any
    // open cell editors, and drop focus so the global Cmd+K handler — not an
    // editor — receives the keystroke.
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.hotbar'))
        .filter((e) => /\bclose\b/.test((e.textContent ?? '').trim()))
        .forEach((e) => (e as HTMLElement).click());

      const h = Array.from(document.querySelectorAll('h1,h2,h3,h4')).find((x) =>
        /command bar|cmd ?\+ ?k/i.test(x.textContent ?? ''),
      );
      h?.scrollIntoView({ block: 'start' });

      const active = document.activeElement as HTMLElement | null;
      active?.blur?.();
      (document.body as HTMLElement).focus?.();
    });
    await pause(page, 500);

    // === Recording starts on the static newsletter section. ===
    await ctrl.mark();
    await pause(page, 300);

    // --- Jump 1: the command-palette module's own page (self-referential). ---
    await page.keyboard.press('Meta+k');
    await pause(page, 420);
    // Results re-rank on every keystroke — three letters already float the
    // module's "open module" hit to the top. No need to type the full name.
    await page.keyboard.type('pal', { delay: 110 });
    await pause(page, 700);
    await page.keyboard.press('Enter');
    // Land on the command-palette doc page ("Press Cmd+K to open", plugin API).
    // First open boots the page fresh; wait for its title so we don't hold on
    // a blank frame.
    await page
      .waitForFunction(
        () =>
          Array.from(document.querySelectorAll('h1')).some((h) =>
            /command palette/i.test(h.textContent ?? ''),
          ),
        { timeout: 6000 },
      )
      .catch(() => {});
    await pause(page, 850);

    // --- Jump 2: the robotArm cell source (the IK function). ---
    await page.keyboard.press('Meta+k');
    await pause(page, 420);
    await page.keyboard.type('rob', { delay: 110 });
    await pause(page, 750);
    await page.keyboard.press('Enter');
    await pause(page, 650);

    // The jump lands showing the cell's output; the source CodeMirror sits
    // just below. Scroll the robotArm source into frame — that IK code is the
    // payoff.
    await page.evaluate(() => {
      const line = Array.from(document.querySelectorAll('.cm-line')).find((l) =>
        /L1\s*=\s*100/.test(l.textContent ?? ''),
      );
      line?.scrollIntoView({ block: 'center' });
    });
    await pause(page, 1100);
  },
);

console.log('cmd-k clip saved →', import.meta.dir);
