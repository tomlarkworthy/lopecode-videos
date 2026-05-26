import { capture, pause } from '../../../../src/capture.ts';
import { resolve } from 'node:path';

// Reuse the persistent profile that auth.ts logged into. Lives inside the
// repo under `.auth/` (gitignored). Run auth.ts once to populate it; the
// session then persists across clip recordings.
const USER_DATA_DIR = resolve(import.meta.dir, '../../../../.auth/chrome-profile');

const NOTEBOOK_PATH =
  '/Users/tom.larkworthy/dev/lopecode-dev/lopebooks/notebooks/@tomlarkworthy_lopecode-newsletter-001.html';
// Newsletter on the left (scrolled to "ATProto publishing"), at-write
// publishWidget on the right.
const HASH = '#view=R100(@tomlarkworthy/lopecode-newsletter-001,S50(@tomlarkworthy/at-write))';
const URL = `file://${NOTEBOOK_PATH}${HASH}`;

await capture(
  {
    url: URL,
    outDir: import.meta.dir,
    videoName: 'atproto',
    warmupMs: 7000,
    userDataDir: USER_DATA_DIR,
  },
  async (page, ctrl) => {
    // Setup: scroll the newsletter to the ATProto publishing section and
    // verify the right pane has the publishWidget rendered + signed in.
    await page.evaluate(() => {
      const h = Array.from(document.querySelectorAll('h2, h3')).find((x) =>
        /atproto publishing/i.test(x.textContent ?? ''),
      ) as HTMLElement | null;
      if (!h) return;
      let n: HTMLElement | null = h;
      while (n && !n.classList?.contains('lm_content')) n = n.parentElement;
      if (n) {
        const r = h.getBoundingClientRect();
        const nr = n.getBoundingClientRect();
        n.scrollTop = n.scrollTop + (r.top - nr.top) - 8;
      }
    });
    await pause(page, 600);

    // Wait until the live-editor tile is present AND has a click listener
    // attached (which happens only after `signedIn` is true inside the
    // widget — currentSession can still be propagating after page load).
    await page.waitForFunction(() => {
      const tile = document.querySelector('[data-source="live-editor"]') as HTMLElement | null;
      if (!tile) return false;
      // The widget only attaches click handlers when signedIn; opacity stays
      // empty (vs 0.5) and cursor:pointer (vs not-allowed) when authOk.
      return tile.style.cursor === 'pointer' && tile.style.opacity === '';
    }, { timeout: 15000 });

    // === Recording starts. ===
    await ctrl.mark();
    await pause(page, 400);

    // 1) Pick "From your live editor". Glide the cursor for the camera, then
    //    fire a synthetic .click() on the exact element — bypasses any
    //    coordinate/child-element ambiguity for the actual event.
    const liveRect = await page.evaluate(() => {
      const el = document.querySelector('[data-source="live-editor"]') as HTMLElement;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(liveRect.x, liveRect.y, { steps: 18 });
    await pause(page, 220);
    await page.evaluate(() => {
      (document.querySelector('[data-source="live-editor"]') as HTMLElement).click();
    });

    // 2) Wait for the title input — it only mounts when stage advances past
    //    'computing' to 'diff' (i.e. after the diff against the user's PDS
    //    completes).
    await page.waitForSelector('input[data-field="title"]', { timeout: 20000 });
    await pause(page, 300);

    // 3) Set the title. rkey is auto-derived from title via slugifyTitle
    //    ("Newsletter 001" → "newsletter-001") and shown live in the rkey
    //    row below the input — typing a human-readable title makes the
    //    title-vs-rkey transformation visible. Stable rkey across
    //    recordings overwrites the same record each time.
    //
    //    Force a dark inline `color` + opaque background on the input
    //    before typing. With the persistent profile, Chrome's autofill
    //    machinery paints the typed text near-white (white-on-cream looks
    //    empty in the recording) even with `autocomplete=off`. An inline
    //    !important rule beats the autofill text fill.
    const titleRect = await page.evaluate(() => {
      const input = document.querySelector('input[data-field="title"]') as HTMLInputElement;
      input.setAttribute('autocomplete', 'off');
      input.style.setProperty('color', '#1a1814', 'important');
      input.style.setProperty('background', '#ffffff', 'important');
      input.style.setProperty('-webkit-text-fill-color', '#1a1814', 'important');
      input.focus();
      const r = input.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(titleRect.x, titleRect.y, { steps: 10 });
    await pause(page, 120);
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('Newsletter 001', { delay: 70 });
    await pause(page, 300);

    // 4) Wait for Publish to enable (canPublish = signedIn && stage='diff').
    //    Diff is already complete by this point but the button enables on
    //    every renderFooter, which fires from the same render cycle.
    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-btn="publish"]') as HTMLButtonElement | null;
      return !!btn && !btn.disabled;
    }, { timeout: 10000 });

    const pubRect = await page.evaluate(() => {
      const btn = document.querySelector('[data-btn="publish"]') as HTMLButtonElement;
      const r = btn.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(pubRect.x, pubRect.y, { steps: 14 });
    await pause(page, 300);

    // 5) Publish.
    await page.evaluate(() => {
      (document.querySelector('[data-btn="publish"]') as HTMLButtonElement).click();
    });

    // 6) Poll for the success card (renderDone — has data-btn="another"). A
    //    first publish uploads ~86 blobs (~2.9 MB) and takes ~30-60s; once
    //    putRecord succeeds the per-DID cache is written and republishes
    //    finish in 1-2 s. Generous timeout covers the first cold run.
    let succeeded = false;
    for (let i = 0; i < 360; i++) {
      await pause(page, 250);
      succeeded = await page.evaluate(() => !!document.querySelector('[data-btn="another"]'));
      if (succeeded) break;
    }
    if (!succeeded) console.warn('[atproto] publish did not reach success state within poll window');

    // Success collapses the form into a smaller card; the right pane's scroll
    // position now sits below the widget. Walk up to the widget root
    // (`position:relative` ancestor with the header h2 "Publish a lopebook"
    // inside) and pin it to the top of the lopepage pane.
    await page.evaluate(() => {
      const another = document.querySelector('[data-btn="another"]') as HTMLElement | null;
      if (!another) return;
      let widget: HTMLElement | null = another;
      while (widget && !widget.querySelector('h2')) widget = widget.parentElement;
      // Step up once more — closest() lands on the cell wrap that contains
      // the whole widget, not the inner body div.
      const root = widget?.closest('.observablehq') as HTMLElement | null ?? widget;
      if (!root) return;
      let pane: HTMLElement | null = root;
      while (pane && !pane.classList?.contains('lm_content')) pane = pane.parentElement;
      if (pane) {
        const r = root.getBoundingClientRect();
        const nr = pane.getBoundingClientRect();
        pane.scrollTop = pane.scrollTop + (r.top - nr.top) - 20;
      } else {
        root.scrollIntoView({ block: 'start' });
      }
    });

    // Hold on the success state. CDP screencast lags state by ~250ms; give
    // a multi-second beat so the success card is unambiguously on screen.
    await pause(page, 2500);
  },
);

console.log('atproto clip saved →', import.meta.dir);
