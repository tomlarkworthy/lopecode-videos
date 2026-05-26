import { capture, pause } from '../../../../src/capture.ts';

const NOTEBOOK_PATH =
  '/Users/tom.larkworthy/dev/lopecode-dev/lopebooks/notebooks/@tomlarkworthy_lopecode-newsletter-001.html';
// Two panes: newsletter (left, scrolled to "Local change history") + the
// `@tomlarkworthy/local-change-history` module on the right showing the
// live timeline plot.
const HASH = '#view=R100(@tomlarkworthy/lopecode-newsletter-001,S50(@tomlarkworthy/local-change-history))';
const URL = `file://${NOTEBOOK_PATH}${HASH}`;

// Target the H1 of the local-change-history module itself (right pane).
// The original text is "Local Change History"; we overwrite it with a
// self-referential title that survives the upcoming reload.
const NEW_HEADING = '# Changes persist across reloads!!!!';
const NEW_HEADING_TEXT = 'Changes persist across reloads';

await capture(
  {
    url: URL,
    outDir: import.meta.dir,
    videoName: 'history',
    warmupMs: 4500,
  },
  async (page, ctrl) => {
    // Setup: scroll left pane so the newsletter's "Local change history"
    // section is in view, and find the right-pane H1 "Local Change History"
    // whose markdown cell we'll edit.
    const editCoords = await page.evaluate(() => {
      // Left pane: scroll the newsletter to the corresponding prose section
      // so both panes are framed on the same feature.
      const newsletterH3 = Array.from(document.querySelectorAll('h3')).find((x) =>
        /local change history/i.test(x.textContent ?? ''),
      ) as HTMLElement | null;
      if (newsletterH3) {
        let n: HTMLElement | null = newsletterH3;
        while (n && !n.classList?.contains('lm_content')) n = n.parentElement;
        if (n) {
          const r = newsletterH3.getBoundingClientRect();
          const nr = n.getBoundingClientRect();
          n.scrollTop = n.scrollTop + (r.top - nr.top) - 8;
        }
      }

      // Right pane: the H1 we're going to overwrite. Its cell wrap is the
      // closest `.observablehq` (no `.lope-editable-md` in this pane), and
      // the matching edit hotbar is the one directly below it.
      const h1 = Array.from(document.querySelectorAll('h1')).find((x) =>
        /^local change history$/i.test((x.textContent ?? '').trim()),
      );
      if (!h1) throw new Error('LCH H1 not found');
      const cell = h1.closest('.observablehq');
      if (!cell) throw new Error('LCH H1 cell wrap not found');
      const cellRect = cell.getBoundingClientRect();
      const hits = Array.from(document.querySelectorAll('.hotbar')).filter((e) =>
        /\bedit\b/.test((e.textContent ?? '').trim()),
      );
      const match = hits
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .find(
          (o) =>
            o.r.left >= cellRect.left - 8 &&
            o.r.top >= cellRect.bottom - 20 &&
            o.r.top <= cellRect.bottom + 80,
        );
      if (!match) throw new Error('LCH H1 edit hotbar not found');
      return { x: match.r.x + match.r.width / 2, y: match.r.y + match.r.height / 2 };
    });

    // Pre-click "edit" so the editor is already mounted when recording starts —
    // editor mount + cursor placement is dead air otherwise.
    await page.mouse.click(editCoords.x, editCoords.y);
    await pause(page, 700);

    // Focus the editor body, select-all, ready to type the new content.
    const editorCoords = await page.evaluate(() => {
      const editors = Array.from(document.querySelectorAll('.cm-editor'));
      const visible = editors
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .filter((o) => o.r.height > 40 && o.r.top >= 0 && o.r.top <= 720);
      const target = visible[visible.length - 1];
      if (!target) throw new Error('No visible editor');
      const content = target.e.querySelector('.cm-content');
      const r = (content ?? target.e).getBoundingClientRect();
      return { x: r.x + 60, y: r.y + 20 };
    });
    await page.mouse.click(editorCoords.x, editorCoords.y);
    await pause(page, 200);
    await page.keyboard.press('Meta+A');
    await pause(page, 150);

    // === Recording starts. Editor is open with all the markdown selected. ===
    await ctrl.mark();
    await pause(page, 200);

    // Replace the cell with a self-referential markdown heading. Keep the
    // `md\`…\`` wrapper — editor-5 compiles the cell as JS, so bare markdown
    // is a syntax error and the cell renders nothing.
    await page.keyboard.type(`md\`${NEW_HEADING}\``, { delay: 12 });
    await pause(page, 200);

    // Commit. Cell re-renders with the new heading; change_listener fires;
    // history gains a new entry; the timeline plot on the right adds a dot.
    await page.keyboard.press('Shift+Enter');
    await pause(page, 200);
    // Note: do NOT click "close" on the editor here. For .observablehq cells
    // editor-5 treats the close button as a discard exit and reverts the
    // cell to its pre-edit definition — undoing the change we just committed.
    // The editor stays open through the reload (its DOM gets thrown out by
    // the page boot anyway); the post-process trim handles the visual gap.

    // Poll the lightning-fs IndexedDB store until the key count stabilizes —
    // that's our signal that the git commit is fully written. If we reload
    // before that, the persistence story silently fails (the change isn't in
    // the replay). On this notebook the count grows from 3 (just-initialized
    // repo) to ~10 (commit blob/refs added), then stops.
    let lastCount = -1;
    let stableFor = 0;
    for (let i = 0; i < 40; i++) {
      await pause(page, 200);
      const count = await page.evaluate(async () => {
        return await new Promise<number>((resolve) => {
          const req = indexedDB.open('lopecode_history');
          req.onsuccess = () => {
            const db = req.result;
            const names = Array.from(db.objectStoreNames);
            if (!names.length) { db.close(); resolve(0); return; }
            const c = db.transaction(names[0], 'readonly').objectStore(names[0]).count();
            c.onsuccess = () => { db.close(); resolve(c.result as number); };
            c.onerror = () => { db.close(); resolve(0); };
          };
          req.onerror = () => resolve(0);
        });
      });
      if (count === lastCount && count > 5) {
        stableFor++;
        if (stableFor >= 2) break;
      } else {
        stableFor = 0;
      }
      lastCount = count;
    }

    // Reload — the punchline. IndexedDB-backed history replays on load, so the
    // edited heading reappears and the timeline shows the recorded change.
    await page.reload({ waitUntil: 'load' });

    // Poll for the replayed heading on the right pane. As soon as it appears,
    // scroll both panes back to where the recording opened — without this,
    // lopepage's restored scroll lands on whatever section it happened to
    // remember last (typically Kiki) and the persistence punchline is offscreen.
    const target = NEW_HEADING_TEXT;
    let foundAt = -1;
    for (let i = 0; i < 30; i++) {
      await pause(page, 200);
      const result = await page.evaluate((targetText: string) => {
        const h1 = Array.from(document.querySelectorAll('h1')).find((x) =>
          new RegExp(targetText, 'i').test(x.textContent ?? ''),
        ) as HTMLElement | null;
        if (!h1) return false;
        // Right pane: bring the replayed H1 to the top.
        let n: HTMLElement | null = h1;
        while (n && !n.classList?.contains('lm_content')) n = n.parentElement;
        if (n) {
          const r = h1.getBoundingClientRect();
          const nr = n.getBoundingClientRect();
          n.scrollTop = n.scrollTop + (r.top - nr.top) - 8;
        }
        // Left pane: re-scroll the newsletter to the corresponding section.
        const newsH3 = Array.from(document.querySelectorAll('h3')).find((x) =>
          /local change history/i.test(x.textContent ?? ''),
        ) as HTMLElement | null;
        if (newsH3) {
          let m: HTMLElement | null = newsH3;
          while (m && !m.classList?.contains('lm_content')) m = m.parentElement;
          if (m) {
            const r2 = newsH3.getBoundingClientRect();
            const mr = m.getBoundingClientRect();
            m.scrollTop = m.scrollTop + (r2.top - mr.top) - 8;
          }
        }
        return true;
      }, target);
      if (result) {
        if (foundAt < 0) foundAt = i;
        if (i - foundAt > 3) break;
      }
    }

    // Final hold so the viewer sees the persisted state on both panes.
    await pause(page, 900);
  },
);

console.log('history clip saved →', import.meta.dir);
