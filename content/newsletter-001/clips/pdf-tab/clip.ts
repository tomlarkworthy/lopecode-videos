import { capture, pause } from '../../../../src/capture.ts';

const NOTEBOOK_PATH =
  '/Users/tom.larkworthy/dev/lopecode-dev/lopebooks/notebooks/@tomlarkworthy_lopecode-newsletter-001.html';
// Boot single-pane. The "Native browser tabs" section has a "Try it:" link
// (an aside) whose href sets the hash to R100(newsletter, S50(.../sample.pdf)),
// which makes lopepage open the PDF attachment in a side pane via the native
// browser PDF viewer.
const URL = `file://${NOTEBOOK_PATH}#view=R100(@tomlarkworthy/lopecode-newsletter-001)`;

const PDF_PARAMS = '#toolbar=0&navpanes=0&scrollbar=0&view=Fit';

await capture(
  {
    url: URL,
    outDir: import.meta.dir,
    videoName: 'pdf-tab',
    warmupMs: 4000,
  },
  async (page, ctrl) => {
    // Install a MutationObserver that catches the PDF iframe the instant
    // lopepage inserts it and forces it to reload with Chrome PDF-viewer
    // fragment params — `toolbar=0&navpanes=0&view=Fit` — so the right pane
    // shows the FULL page (no toolbar, no thumbnail sidebar / "print preview"
    // chrome). A fragment-only change on an already-loaded iframe is a no-op,
    // so we bounce through about:blank to force a genuine reload. Catching it
    // on insertion (before the chrome-ful viewer paints) avoids a flicker.
    await page.evaluate((params) => {
      const fix = (ifr: HTMLIFrameElement) => {
        if (!ifr.src.startsWith('blob:')) return;
        if (ifr.dataset.pdfFixed === '1') return;
        ifr.dataset.pdfFixed = '1';
        const base = ifr.src.split('#')[0];
        ifr.src = 'about:blank';
        requestAnimationFrame(() => {
          ifr.src = base + params;
        });
      };
      const scan = (root: ParentNode) => {
        root.querySelectorAll?.('iframe').forEach((f) => fix(f as HTMLIFrameElement));
      };
      scan(document);
      const mo = new MutationObserver((muts) => {
        for (const m of muts) {
          m.addedNodes.forEach((n) => {
            if (n instanceof HTMLIFrameElement) fix(n);
            else if (n instanceof Element) scan(n);
          });
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
      (window as unknown as { __pdfFixObserver?: MutationObserver }).__pdfFixObserver = mo;
    }, PDF_PARAMS);

    // Pre-warm the PDF: open the two-pane view once so the browser fetches the
    // attachment bytes and spins up PDF.js (now via the params path, thanks to
    // the observer), let it fully render, then navigate back to single pane.
    // The recorded click then renders the full-page PDF fast (warm caches).
    await page.evaluate(() => {
      window.location.hash =
        '#view=R100(@tomlarkworthy/lopecode-newsletter-001,S50(@tomlarkworthy/lopecode-newsletter-001/sample.pdf))';
    });
    await pause(page, 3500);
    await page.evaluate(() => {
      window.location.hash = '#view=R100(@tomlarkworthy/lopecode-newsletter-001)';
    });
    await pause(page, 1200);

    // Setup (pre-recording): scroll the "Native browser tabs" heading to the
    // top so the prose + "Try it:" link fill the left of the frame, and locate
    // the link's click coordinates.
    const link = await page.evaluate(() => {
      const h = Array.from(document.querySelectorAll('h3')).find((x) =>
        /native browser tabs/i.test(x.textContent ?? ''),
      );
      h?.scrollIntoView({ block: 'start' });
      const a = Array.from(document.querySelectorAll('a')).find((x) =>
        /sample\.pdf/i.test(x.textContent ?? ''),
      ) as HTMLAnchorElement | undefined;
      if (!a) throw new Error('sample.pdf link not found');
      const r = a.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await pause(page, 500);

    // Park the cursor near the link. The cursor is invisible in the screencast,
    // so any pre-click motion/wait is dead air — keep the lead-in short, just
    // enough for the eye to register the "Try it:" prose before the reveal.
    await page.mouse.move(link.x - 60, link.y, { steps: 4 });
    await pause(page, 200);

    // === Recording starts: prose + link visible, single pane. ===
    await ctrl.mark();
    await pause(page, 500);

    // Click the link. The pane split + full-page PDF render are the payoff.
    await page.mouse.move(link.x, link.y, { steps: 6 });
    await page.mouse.down();
    await page.mouse.up();

    // The left pane shrinks 100%→50% and reflows; lopepage resets its scroll.
    // A fixed-pixel scroll lock fails because the heading moves when the column
    // reflows. Instead, re-anchor to the HEADING every animation frame — that
    // tracks its true position through the relayout so the left pane stays
    // pinned to "Native browser tabs" with no visible jump.
    await page.evaluate(() => {
      const h = Array.from(document.querySelectorAll('h3')).find((x) =>
        /native browser tabs/i.test(x.textContent ?? ''),
      );
      if (!h) return;
      let raf = 0;
      const tick = () => {
        h.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      setTimeout(() => cancelAnimationFrame(raf), 1500);
    });

    // Hold on the clean composed frame: prose + link left, full-page PDF right.
    await pause(page, 1600);
  },
);

console.log('pdf-tab clip saved →', import.meta.dir);
