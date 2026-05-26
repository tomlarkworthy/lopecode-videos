import { capture, pause } from '../../../../src/capture.ts';

// Pairing cut at 00:10: "Claude Code terminal beside notebook".
//
// Choreography (three beats):
//   1. Terminal (faked) — the `claude --dangerously-load-development-channels
//      server:lopecode` command has been entered; Claude Code is up and
//      "Listening for channel messages from: server:lopecode". The terminal's
//      only job is to START the pairing session.
//   2. Minimize the terminal / maximize the browser — the terminal shrinks
//      away to the dock, revealing the real, paired notebook beneath it.
//   3. Type the request in the BROWSER — into the @tomlarkworthy/claude-code-
//      pairing pane's real "Message Claude…" chat box (NOT the terminal):
//      "disassemble this notebook to my local disk".
//
// Real vs faked: the terminal is a position:fixed DOM window (CDP screencast
// can't film Terminal.app — see series CLAUDE.md "Faking browser/OS chrome…"),
// modelled on reference screenshots of the real boot. The notebook is genuinely
// paired: the capture page loads with `&cc=<token>` to a live Claude Code
// channel session, so the pane shows a true "● Connected" and a real chat box.
// We type the ask into that real box but do NOT send / run file-sync.
//
//   LOPE_CC=LOPE-NNNNN-XXXX bun content/newsletter-001/clips/pairing/clip.ts

const NB =
  '/Users/tom.larkworthy/dev/lopecode-dev/lopebooks/notebooks/@tomlarkworthy_lopecode-newsletter-001.html';
const CC = process.env.LOPE_CC ?? '';
const HASH =
  '#view=R100(S55(@tomlarkworthy/lopecode-newsletter-001),S45(@tomlarkworthy/claude-code-pairing))' +
  (CC ? `&cc=${CC}` : '');
const URL = `file://${NB}${HASH}`;

const ASK = 'disassemble this notebook to my local disk';

if (!CC) console.warn('[pairing] no LOPE_CC token — pairing pane will show "Not connected".');

await capture(
  {
    url: URL,
    outDir: import.meta.dir,
    videoName: 'pairing',
    warmupMs: 4500,
  },
  async (page, ctrl) => {
    // --- Setup (before mark): frame the panes, build the terminal. ---

    // Left (newsletter) column → its "Claude Code Pairing Module" section, so
    // what's revealed under the terminal is on-message. Right (pairing) pane →
    // top, so the Connected badge + the "Message Claude…" chat box are in view.
    await page.evaluate(() => {
      const findScroller = (el: Element | null) => {
        let s = el as HTMLElement | null;
        while (s && !s.classList?.contains('lm_content')) s = s.parentElement;
        return s;
      };
      const cc = document.querySelector('textarea.cc-input');
      findScroller(cc)?.scrollTo({ top: 0 });
      const h = Array.from(document.querySelectorAll('h1,h2,h3')).find((e) =>
        /claude code pairing/i.test(e.textContent ?? ''),
      );
      const nl = findScroller(h ?? null);
      if (h && nl) nl.scrollTop += h.getBoundingClientRect().top - nl.getBoundingClientRect().top - 12;
      (document.activeElement as HTMLElement | null)?.blur?.();
    });
    await pause(page, 500);

    // Build the faked macOS Terminal window, near-full-frame, "prompt-ready".
    await page.evaluate(() => {
      const css = `
        #__term, #__term * { box-sizing: border-box; }
        #__term {
          position: fixed; left: 40px; top: 32px; width: 1200px; height: 656px;
          z-index: 100000; border-radius: 11px; overflow: hidden; transform-origin: 0 100%;
          background: #1b1e25; color: #d8dee9;
          font: 15.5px/1.55 'SF Mono','Menlo','Monaco','Roboto Mono',monospace;
          box-shadow: 0 26px 70px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.4);
          border: 1px solid rgba(255,255,255,.06);
        }
        #__term .bar {
          height: 40px; background: #2b2f38; display: flex; align-items: center;
          padding: 0 12px; gap: 8px; position: relative; border-bottom: 1px solid rgba(0,0,0,.35);
        }
        #__term .dot { width: 12px; height: 12px; border-radius: 50%; }
        #__term .dot.r { background: #ff5f57; } #__term .dot.y { background: #febc2e; } #__term .dot.g { background: #28c840; }
        #__term .title {
          position: absolute; left: 0; right: 0; text-align: center; color: #aeb4bf;
          font-size: 12.5px; font-weight: 600; pointer-events: none; white-space: nowrap;
          overflow: hidden; padding: 0 150px; text-overflow: ellipsis;
        }
        #__term .tabs {
          display: flex; align-items: stretch; height: 34px; background: #21242c; gap: 8px;
          padding: 5px 8px 0; border-bottom: 1px solid #14161b; font-size: 12.5px; color: #6b7280;
        }
        #__term .tab {
          display: flex; align-items: center; padding: 0 16px; border-radius: 7px 7px 0 0;
          max-width: 180px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
        }
        #__term .tab.active { background: #1b1e25; color: #cdd3dd; }
        #__term .body { padding: 18px 22px; height: calc(100% - 40px - 34px); overflow: hidden; }
        #__term .lav { color: #b9a9ff; } #__term .pink { color: #ff6a8b; } #__term .red { color: #ff5277; }
        #__term .dim { color: #6b7280; } #__term .wht { color: #e7ebf0; font-weight: 600; }
        #__term .robot {
          display: inline-grid; grid-template-columns: repeat(5, 8px); grid-auto-rows: 8px;
          gap: 1px; vertical-align: top; margin: 4px 16px 0 2px;
        }
        #__term .robot i { background: #c8825f; border-radius: 1px; }
        #__term .robot i.k { background: #1b1e25; } #__term .robot i.o { background: transparent; }
        #__term .banner { display: flex; align-items: flex-start; margin: 2px 0 16px; }
        #__term .inputbox {
          margin-top: 18px; border: 1px solid #39414e; border-radius: 9px; padding: 10px 13px;
          display: flex; align-items: center; gap: 9px; color: #cdd3dd; max-width: 1050px;
        }
        #__term .caret {
          display: inline-block; width: 9px; height: 19px; background: #cdd3dd; margin-left: 1px;
          vertical-align: -4px; animation: __blink 1.05s steps(1) infinite;
        }
        @keyframes __blink { 0%,50% { opacity: 1; } 50.01%,100% { opacity: 0; } }
        #__term .hint { margin-top: 11px; color: #6b7280; font-size: 13.5px; }
      `;
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);

      const R = ['o k k k o', 'k . . . k', 'k k . k k', 'k . . . k', 'o k k k o']
        .map((row) =>
          row.split(' ').map((c) => (c === 'k' ? '<i class="k"></i>' : c === 'o' ? '<i class="o"></i>' : '<i></i>')).join(''),
        )
        .join('');

      const term = document.createElement('div');
      term.id = '__term';
      term.innerHTML = `
        <div class="bar">
          <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
          <span class="title">lopecode-dev — ✳ Claude Code — bun ‹ claude --dangerously-load-development-channels server:lopecode</span>
        </div>
        <div class="tabs">
          <div class="tab">…e973f96a40ae</div><div class="tab">…bun ‹ metadev</div><div class="tab active">…erver:lopecode</div>
        </div>
        <div class="body">
          <div><span class="pink">[</span>tom.larkworthy@Mac lopecode-dev % <span class="lav">claude --dangerously-load-development-channels server:lopecode</span></div>
          <div class="banner">
            <span class="robot">${R}</span>
            <div>
              <div><span class="wht">Claude Code</span> <span class="dim">v2.1.150</span></div>
              <div class="dim">Opus 4.7 (1M context) · Claude Team</div>
              <div class="dim">~/dev/lopecode-dev</div>
            </div>
          </div>
          <div><span class="pink">Listening for channel messages from:</span> <span class="red">server:lopecode</span></div>
          <div class="dim">Experimental · inbound messages will be pushed into this session, this carries prompt injection risk.</div>
          <div class="inputbox"><span class="lav">❯</span><span class="caret"></span></div>
          <div class="hint">? for shortcuts · ← for agents</div>
        </div>
      `;
      document.body.appendChild(term);
    });
    await pause(page, 400);

    // === Recording starts on the terminal (pairing session up). ===
    await ctrl.mark();

    // Freeze the notebook's rAF reactivity (it's already rendered "Connected").
    // Otherwise its animation cells hog the main thread and stutter the reveal
    // + the textarea repaint. The terminal caret blink and the minimize/dock
    // transition are CSS, so they keep emitting frames.
    await page.evaluate(() => {
      (window as any).__origRAF = window.requestAnimationFrame.bind(window);
      (window as any).requestAnimationFrame = () => 0;
    });
    await pause(page, 1300);

    // Beat 2: minimize the terminal to the dock, maximize the browser.
    await page.evaluate(() => {
      const t = document.getElementById('__term')!;
      t.style.transition = 'transform .55s cubic-bezier(.5,0,.75,0), opacity .55s ease-in';
      t.style.transform = 'translate(-560px, 380px) scale(0.06)';
      t.style.opacity = '0';
      setTimeout(() => (t.style.display = 'none'), 650);
    });
    await pause(page, 850);

    // Beat 3: type the request into the REAL pairing chat box (not the terminal).
    const box = await page.evaluate(() => {
      const ta = document.querySelector('textarea.cc-input') as HTMLTextAreaElement | null;
      if (!ta) return null;
      ta.scrollIntoView({ block: 'center' });
      const r = ta.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!box) throw new Error('pairing chat textarea (.cc-input) not found');
    await page.mouse.move(box.x, box.y, { steps: 22 });
    await pause(page, 250);
    await page.mouse.click(box.x, box.y);
    await pause(page, 250);
    await page.keyboard.type(ASK, { delay: 55 });
    await pause(page, 700);

    // Restore rAF so the pairing pane can re-render after Send (the chat log
    // update is reactive; with rAF stubbed it wouldn't paint).
    await page.evaluate(() => {
      if ((window as any).__origRAF) (window as any).requestAnimationFrame = (window as any).__origRAF;
    });

    // Press Send to complete the scene. This delivers the message to the live
    // pairing session for real; the chat shows the sent request.
    const send = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find((e) => /^send$/i.test((e.textContent ?? '').trim()));
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!send) throw new Error('Send button not found');
    await page.mouse.move(send.x, send.y, { steps: 18 });
    await pause(page, 350);
    await page.mouse.click(send.x, send.y);
    await pause(page, 1700);
  },
);

console.log('pairing clip saved →', import.meta.dir);
