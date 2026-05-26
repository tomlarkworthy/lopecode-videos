import { capture, pause } from '../../../../src/capture.ts';

const NOTEBOOK_PATH =
  '/Users/tom.larkworthy/dev/lopecode-dev/lopebooks/notebooks/@tomlarkworthy_lopecode-newsletter-001.html';
// Two panes: the newsletter's "Exporter-3 Upgrades" section (left) beside the
// full exporter-3 module (right) — its title, the live Download UI, and the
// detailed feature list. The story: the section talks about it; the real
// module sits right there; hit Download and the single self-contained file
// drops out.
const HASH =
  '#view=R100(@tomlarkworthy/lopecode-newsletter-001,S50(@tomlarkworthy/exporter-3))';
const URL = `file://${NOTEBOOK_PATH}${HASH}`;

await capture(
  {
    url: URL,
    outDir: import.meta.dir,
    videoName: 'exporter',
    warmupMs: 4000,
  },
  async (page, ctrl) => {
    // Swallow the real download the exporter triggers (saved to a temp dir we
    // ignore) so the page doesn't hang.
    page.on('download', (d) => d.path().catch(() => {}));

    // Setup: frame both panes. Left → the "Exporter-3 Upgrades" heading; right
    // → the top of the exporter-3 module so its title + Download UI show.
    await page.evaluate(() => {
      const exH = Array.from(document.querySelectorAll('h3')).find((h) =>
        /exporter-3 upgrades/i.test(h.textContent ?? ''),
      );
      exH?.scrollIntoView({ block: 'start' });

      // Right pane: scroll the exporter-3 module to its top.
      const ex3H1 = Array.from(document.querySelectorAll('h1')).find((h) =>
        /^exporter 3$/i.test((h.textContent ?? '').trim()),
      );
      let s: HTMLElement | null = ex3H1 as HTMLElement;
      while (s && !s.classList?.contains('lm_content')) s = s.parentElement;
      s?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });

      (document.activeElement as HTMLElement | null)?.blur?.();
    });
    await pause(page, 600);

    // === Recording starts: both panes framed, Download UI visible. ===
    await ctrl.mark();
    await pause(page, 500);

    // Locate the Download button in the exporter-3 pane.
    const dl = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        /^download$/i.test((b.textContent ?? '').trim()),
      )!;
      const r = btn.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });

    // Move to the Download button and click it (real export fires; the browser
    // download shelf is chrome the screencast can't show, so we stage it next).
    await page.mouse.move(dl.x, dl.y, { steps: 22 });
    await pause(page, 300);
    await page.mouse.click(dl.x, dl.y);
    await pause(page, 450);

    // Stage the download shelf: a Chrome-style pill slides up bottom-left with
    // the single self-contained .html file.
    await page.evaluate(() => {
      const pill = document.createElement('div');
      pill.id = '__dl_pill';
      pill.style.cssText =
        'position:fixed; left:18px; bottom:18px; z-index:100000; display:flex;' +
        'align-items:center; gap:11px; background:#2b2b2b; color:#f1f1f1;' +
        'border:1px solid #474747; border-radius:9px; padding:10px 14px;' +
        'box-shadow:0 6px 22px rgba(0,0,0,.55);' +
        "font:13px/1.25 ui-sans-serif,system-ui,sans-serif;" +
        'transform:translateY(140%); transition:transform .4s cubic-bezier(.2,.85,.25,1);';
      pill.innerHTML =
        '<div style="width:30px;height:30px;border-radius:6px;background:#3a6df0;' +
        'display:flex;align-items:center;justify-content:center;font-size:15px;">⬇</div>' +
        '<div><div style="font-weight:600;">@tomlarkworthy_lopecode-newsletter-001.html</div>' +
        '<div style="opacity:.6;font-size:11px;margin-top:2px;">1.9&nbsp;MB&nbsp;·&nbsp;Done</div></div>';
      document.body.appendChild(pill);
      requestAnimationFrame(() => (pill.style.transform = 'translateY(0)'));
    });

    // Hold on the result: the docs, the UI, and the one file it produced.
    await pause(page, 1500);
  },
);

console.log('exporter clip saved →', import.meta.dir);
