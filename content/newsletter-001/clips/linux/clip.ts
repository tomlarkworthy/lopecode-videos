import { capture, pause } from '../../../../src/capture.ts';

const NL =
  '/Users/tom.larkworthy/dev/lopecode-dev/lopebooks/notebooks/@tomlarkworthy_lopecode-newsletter-001.html';
const SBC =
  '/Users/tom.larkworthy/dev/lopecode-dev/lopebooks/notebooks/@tomlarkworthy_linux-sbc.html';
// Start in the newsletter; the clip clicks the "linux-sbc" external link and
// rides the in-page navigation into the emulator notebook (the capture
// framework re-arms the screencast across navigation).
const URL = `file://${NL}#view=R100(@tomlarkworthy/lopecode-newsletter-001)`;
// Land directly on a single linux-sbc pane (drop the module-selection panel).
const SBC_URL = `file://${SBC}#view=R100(@tomlarkworthy/linux-sbc)`;

await capture(
  {
    url: URL,
    outDir: import.meta.dir,
    videoName: 'linux',
    warmupMs: 3500,
  },
  async (page, ctrl) => {
    // Setup: close any stray open cell editors (e.g. the "kiki expression…"
    // box that otherwise sits at the top of frame 1), frame the "Embedded
    // Linux?" section at the top, and point the linux-sbc link at the local
    // file (single-pane hash), same-tab. Done before mark().
    // Point the link at the local file (single-pane), same-tab, and tint it.
    await page.evaluate((sbcUrl) => {
      const link = (Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[]).find(
        (a) => /^linux-sbc$/i.test((a.textContent ?? '').trim()),
      );
      if (!link) throw new Error('linux-sbc link not found');
      link.href = sbcUrl;
      link.target = '_self';
      link.style.background = 'rgba(88,166,255,0.25)';
      link.style.padding = '1px 4px';
      link.style.borderRadius = '3px';
    }, SBC_URL);

    // Frame the linux section: scroll the "Embedded Linux?" heading flush to
    // the top of its `.lm_content` scroll container so the clip opens on the
    // linux section (the kiki REPL widget just above it scrolls off-frame).
    // Re-assert after a beat to beat late layout shifts from the kiki widget.
    const frameLinuxSection = () =>
      page.evaluate(() => {
        const heading = Array.from(document.querySelectorAll('h3')).find((h) =>
          /embedded linux/i.test(h.textContent ?? ''),
        );
        if (!heading) return;
        let scroller: HTMLElement | null = heading as HTMLElement;
        while (scroller && !scroller.classList?.contains('lm_content')) scroller = scroller.parentElement;
        if (!scroller) return;
        const delta =
          heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 16;
        scroller.scrollTop += delta;
      });
    await frameLinuxSection();
    await pause(page, 600);
    await frameLinuxSection();
    await pause(page, 300);

    // === Recording starts on the newsletter, link in view. ===
    await ctrl.mark();
    await pause(page, 500);

    // Click the link → navigate into linux-sbc.
    const linkBox = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a')) as HTMLAnchorElement[];
      const link = links.find((a) => /^linux-sbc$/i.test((a.textContent ?? '').trim()));
      const r = link!.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(linkBox.x, linkBox.y, { steps: 16 });
    await pause(page, 250);
    await page.mouse.click(linkBox.x, linkBox.y);

    // Wait for the linux-sbc notebook to load.
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('button')).some((b) => /boot\s*&?\s*run/i.test(b.textContent ?? '')),
      { timeout: 15000 },
    );
    await pause(page, 800);

    // Compose: center the boot UI container on a dark backdrop with a title.
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        /boot\s*&?\s*run/i.test(b.textContent ?? ''),
      );
      if (!btn) throw new Error('boot button gone after compose');
      // The boot container holds the button row, the mode-timeline canvas, and
      // the terminal+input. Walk up to the div that owns the canvas + input.
      let box: HTMLElement | null = btn as HTMLElement;
      for (let i = 0; i < 6 && box; i++) {
        if (box.querySelector('canvas') && box.querySelector('input') && box.tagName === 'DIV') break;
        box = box.parentElement;
      }
      if (!box) throw new Error('boot container not found');

      const backdrop = document.createElement('div');
      backdrop.style.cssText = 'position:fixed; inset:0; background:#06080d; z-index:1;';
      document.body.appendChild(backdrop);

      const title = document.createElement('div');
      title.textContent = 'linux-sbc · RISC-V Linux 6.1, booting in the browser';
      title.style.cssText =
        'position:fixed; top:90px; left:0; right:0; text-align:center; color:#9fb3c8; ' +
        'font:600 18px/1.3 ui-sans-serif,system-ui,sans-serif; letter-spacing:0.03em; z-index:5;';
      document.body.appendChild(title);

      // Pin the container at native scale, centered. The container is 1200px
      // wide and the frame is 1280px, so it fits edge-to-edge with ~40px
      // margins. Do NOT scale up — scaling overflowed the frame and clipped
      // the left edge of the console (the kernel-log timestamps).
      Object.assign(box.style, {
        position: 'fixed',
        left: '40px',
        top: '150px',
        width: '1200px',
        zIndex: '3',
        margin: '0',
        background: 'transparent',
      } as Partial<CSSStyleDeclaration>);
    });
    await pause(page, 600);

    // Click Boot & Run.
    const bootBox = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) =>
        /boot\s*&?\s*run/i.test(b.textContent ?? ''),
      );
      const r = btn!.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(bootBox.x, bootBox.y, { steps: 14 });
    await pause(page, 250);
    await page.mouse.click(bootBox.x, bootBox.y);

    // Boot. The status counter animates every rAF so frames flow continuously
    // (no truly-static stretch — the "dead" middle is real footage to be
    // time-lapsed in post, not a held frame). Wait until /init runs and the
    // BusyBox "~ #" prompt is up.
    const booted = await page
      .waitForFunction(() => /Run \/init as init process/.test(document.body.innerText), {
        timeout: 45000,
      })
      .then(() => true)
      .catch(() => false);
    console.log('[clip] booted (init reached):', booted);

    await pause(page, 1500);

    // Type `uname -a` into the TERMINAL command input (placeholder
    // "...press Enter..."), NOT the command-palette input ("Type a command...").
    const typed = await page.evaluate(() => {
      const input = Array.from(document.querySelectorAll('input')).find((i) =>
        /press enter/i.test((i as HTMLInputElement).placeholder ?? ''),
      ) as HTMLInputElement | undefined;
      if (!input) return false;
      input.focus();
      return true;
    });
    if (typed) {
      await page.keyboard.type('uname -a', { delay: 90 });
      await pause(page, 400);
      await page.keyboard.press('Enter');
      await pause(page, 2000);
    } else {
      console.log('[clip] terminal input not found');
    }

    await pause(page, 900);
  },
);

console.log('linux clip saved →', import.meta.dir);
