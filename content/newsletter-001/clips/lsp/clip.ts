import { capture, pause } from '../../../../src/capture.ts';

const NOTEBOOK_PATH =
  '/Users/tom.larkworthy/dev/lopecode-dev/lopebooks/notebooks/@tomlarkworthy_lopecode-newsletter-001.html';
// Boot to the module; we navigate to #lsp via hashchange after boot
// (the anchor only resolves through lopepage's hashchange handler, not initial parse).
const HASH = '#view=R100(@tomlarkworthy/lopecode-newsletter-001)';
const URL = `file://${NOTEBOOK_PATH}${HASH}`;

await capture(
  {
    url: URL,
    outDir: import.meta.dir,
    videoName: 'lsp',
    warmupMs: 3500,
    // ~1.78× zoom, 16:9. Anchored at top-left so the LSP heading sits at the
    // top of the frame, and tall enough that the autocomplete popup
    // (which renders just below the typed `Inputs.r`) stays in-frame.
    crop: { x: 0, y: 0, w: 720, h: 405 },
  },
  async (page, ctrl) => {
    // Setup work — happens BEFORE recording starts.
    const editCoords = await page.evaluate(() => {
      const h = Array.from(document.querySelectorAll('h3')).find((x) =>
        /lsp/i.test(x.textContent ?? ''),
      );
      if (!h) throw new Error('LSP heading not found');
      h.scrollIntoView({ block: 'start' });
      const cell = h.closest('.lope-editable-md');
      if (!cell) throw new Error('LSP cell wrap not found');
      const cellRect = cell.getBoundingClientRect();
      const hits = Array.from(document.querySelectorAll('.hotbar')).filter((e) =>
        /\bedit\b/.test((e.textContent ?? '').trim()),
      );
      const match = hits
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .find((o) => o.r.top >= cellRect.bottom - 5 && o.r.top <= cellRect.bottom + 80);
      if (!match) throw new Error('LSP cell edit hotbar not found');
      return { x: match.r.x + match.r.width / 2, y: match.r.y + match.r.height / 2 };
    });
    // Open the editor BEFORE recording starts so the mount delay isn't dead air.
    await page.mouse.click(editCoords.x, editCoords.y);
    await pause(page, 600);

    // Focus the editor body. The newly mounted .cm-content for this cell is the last one in the DOM.
    const editorCoords = await page.evaluate(() => {
      const editors = Array.from(document.querySelectorAll('.cm-editor'));
      const visible = editors
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .filter((o) => o.r.height > 40 && o.r.top >= 0 && o.r.top <= 720);
      const target = visible[visible.length - 1];
      if (!target) throw new Error('No visible editor');
      const content = target.e.querySelector('.cm-content');
      const r = (content ?? target.e).getBoundingClientRect();
      return { x: r.x + 80, y: r.y + 20 };
    });
    await page.mouse.click(editorCoords.x, editorCoords.y);
    await pause(page, 200);
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Delete');
    await pause(page, 150);

    // Recording starts here — editor is already open and empty.
    await ctrl.mark();
    await pause(page, 150);

    await page.keyboard.type('Inputs.r', { delay: 110 });
    // Popup appears; `radio` is highlighted by default.
    await pause(page, 800);
    // Accept the highlighted entry — text becomes `Inputs.radio`.
    await page.keyboard.press('Enter');
    await pause(page, 450);
  },
);

console.log('lsp clip saved →', import.meta.dir);
