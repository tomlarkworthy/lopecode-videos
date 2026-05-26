import { capture, pause } from '../../../../src/capture.ts';

const NOTEBOOK_PATH =
  '/Users/tom.larkworthy/dev/lopecode-dev/lopebooks/notebooks/@tomlarkworthy_parametric-svg.html';
// Open the parametric-svg notebook directly (not the newsletter) because we
// want both the robot arm and the bezier example visible simultaneously.
// Lopepage refuses to mount the same module twice, so we use a single pane
// and CSS-reposition the cell wrappers into a side-by-side composition. They
// stay bound to their live reactive cells; only the visual layout changes.
const URL = `file://${NOTEBOOK_PATH}`;

await capture(
  {
    url: URL,
    outDir: import.meta.dir,
    videoName: 'parametric-svg',
    warmupMs: 4000,
  },
  async (page, ctrl) => {
    // Compose: find the cell wrappers for the arm, the sliders, and the
    // bezier, and pin them into a side-by-side layout. The story is that the
    // sliders animate in lockstep with the drag — so we MUST keep them in
    // frame.
    await page.evaluate(() => {
      const svgs = Array.from(document.querySelectorAll('svg[viewBox="0 0 400 400"]'));
      const armSvg = svgs.find((s) => s.querySelector('#bg'));
      const bezierSvg = svgs.find((s) => s.querySelector('#bz-bg'));
      if (!armSvg || !bezierSvg) {
        throw new Error(
          `arm or bezier SVG not found (candidates: ${svgs.length}; arm=${!!armSvg} bez=${!!bezierSvg})`,
        );
      }

      const findCellWrap = (el: Element): HTMLElement => {
        let n: HTMLElement | null = el as HTMLElement;
        while (n && !n.classList.contains('observablehq')) n = n.parentElement;
        if (!n) throw new Error('observablehq wrapper not found');
        return n;
      };
      const armWrap = findCellWrap(armSvg);
      const bezierWrap = findCellWrap(bezierSvg);

      // Slider cells: each Inputs.range produces a <form> with three children
      // (label, input[type=range], input[type=text]). Find them by label text.
      const sliderForms = Array.from(document.querySelectorAll('form')).filter((f) => {
        const lbl = f.querySelector('label')?.textContent ?? '';
        return /θ\d|theta\d/i.test(lbl) || /(base|elbow|wrist)/i.test(lbl);
      });
      const armSliders = sliderForms
        .slice(0, 3)
        .map((f) => findCellWrap(f));

      // Find bezier slider(s). The bezier has a "Samples" range input.
      const bezierSamplesForm = Array.from(document.querySelectorAll('form')).find((f) => {
        const lbl = f.querySelector('label')?.textContent ?? '';
        return /samples/i.test(lbl);
      });
      const bezierSliderWrap = bezierSamplesForm ? findCellWrap(bezierSamplesForm) : null;

      // Backdrop. We DON'T set visibility:hidden on body.children because the
      // svgEditor overlay is appended to <body> directly; hiding body kids
      // also hides the overlay, breaking pointer events on the drag area.
      // Instead we layer a full-screen opaque backdrop with z-index lower
      // than the pinned cells but higher than the underlying page.
      const backdrop = document.createElement('div');
      backdrop.style.cssText =
        'position:fixed; inset:0; background:#0a0e14; z-index:1;';
      document.body.appendChild(backdrop);

      const labelStyle =
        'position:fixed; top:18px; color:#cbd5e1; font:600 14px/1.2 ui-sans-serif,system-ui,sans-serif; ' +
        'letter-spacing:0.04em; text-transform:uppercase; z-index:5;';
      const armLabel = document.createElement('div');
      armLabel.textContent = 'Inverse Kinematics — Drag the Tip';
      armLabel.style.cssText = labelStyle + ' left:40px;';
      document.body.appendChild(armLabel);

      const bezierLabel = document.createElement('div');
      bezierLabel.textContent = 'Bezier — Pin Two Points, Flip the Arch';
      bezierLabel.style.cssText = labelStyle + ' left:720px;';
      document.body.appendChild(bezierLabel);

      // Pin layout.
      // Left column (640px wide centered around x=320):
      //   - Sliders stacked at top (y=50..200)
      //   - Arm SVG below (y=210..690), centered horizontally, 480px wide
      // Right column (640px wide centered around x=960):
      //   - Bezier SVG centered (y=210..690), 480px wide
      const pin = (
        wrap: HTMLElement,
        opts: { left: number; top: number; width: number; height?: number },
      ) => {
        Object.assign(wrap.style, {
          position: 'fixed',
          left: `${opts.left}px`,
          top: `${opts.top}px`,
          width: `${opts.width}px`,
          ...(opts.height ? { height: `${opts.height}px` } : {}),
          zIndex: '3',
          margin: '0',
          padding: '0',
          background: 'transparent',
        } as Partial<CSSStyleDeclaration>);
      };

      // Stack the 3 arm sliders vertically along the top of the left column.
      // Inputs.range renders at ~360px natural width, so each row needs ≥360.
      armSliders.forEach((wrap, idx) => {
        pin(wrap, { left: 80, top: 50 + idx * 38, width: 480 });
      });

      // Pin arm SVG wrap on the left half, below the sliders.
      pin(armWrap, { left: 80, top: 200, width: 480, height: 480 });

      // Pin bezier SVG wrap on the right half.
      pin(bezierWrap, { left: 720, top: 80, width: 480, height: 480 });

      // Pin bezier samples slider just under the bezier SVG.
      if (bezierSliderWrap) {
        pin(bezierSliderWrap, { left: 720, top: 580, width: 480 });
      }

      // Re-size inner SVGs whenever the cells re-render (parameter updates
      // replace the SVG node inside the wrap).
      const stretchSvgs = () => {
        const armSvgNow = armWrap.querySelector('svg');
        const bezSvgNow = bezierWrap.querySelector('svg');
        if (armSvgNow) {
          armSvgNow.setAttribute('width', '480');
          armSvgNow.setAttribute('height', '480');
          (armSvgNow as SVGElement).style.display = 'block';
        }
        if (bezSvgNow) {
          bezSvgNow.setAttribute('width', '480');
          bezSvgNow.setAttribute('height', '480');
          (bezSvgNow as SVGElement).style.display = 'block';
        }
      };
      stretchSvgs();
      const mo = new MutationObserver(stretchSvgs);
      mo.observe(armWrap, { childList: true, subtree: true });
      mo.observe(bezierWrap, { childList: true, subtree: true });
    });

    // Wait for svgEditor overlays to resync to the new SVG rects.
    await pause(page, 800);

    // Locate anchors in post-composition coords. For the bezier we want the
    // curve sample anchors at ~25%, ~50%, ~75% along t — with `bezierSamples`
    // = 10 these are t = 3/11, 6/11, 8/11 (closest grid points). The 50%
    // anchor will be dragged downwards so the arch flips over while the 25%
    // and 75% anchors stay pinned via shift+click.
    const anchors = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('.__anchor')) as HTMLElement[];
      const center = (el: HTMLElement | undefined) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      };
      const byId = (id: string) => all.find((a) => a.dataset.anchorId === id);
      // Find the curve-* anchor whose t value is closest to the target.
      const curveByT = (target: number) => {
        const candidates = all
          .filter((a) => (a.dataset.anchorId ?? '').startsWith('curve-'))
          .map((a) => ({
            el: a,
            t: parseFloat((a.dataset.anchorId ?? 'curve-NaN').slice('curve-'.length)),
          }))
          .filter((c) => !Number.isNaN(c.t))
          .sort((p, q) => Math.abs(p.t - target) - Math.abs(q.t - target));
        return candidates[0]?.el;
      };
      return {
        ee: center(byId('end-effector')),
        lockA: center(curveByT(0.25)),
        mid: center(curveByT(0.5)),
        lockB: center(curveByT(0.75)),
      };
    });
    const ee = anchors.ee;
    if (!ee || !anchors.lockA || !anchors.mid || !anchors.lockB) {
      throw new Error(`anchors missing: ${JSON.stringify(anchors)}`);
    }

    // ===== Setup: lock 25% and 75% along the curve BEFORE recording =====
    // Shift+click pins each anchor; the locked anchors render with a yellow
    // ring. With both quarter-points pinned, dragging the 50% point downwards
    // forces the curve to flip its arch.
    await page.keyboard.down('Shift');
    for (const a of [anchors.lockA, anchors.lockB]) {
      await page.mouse.move(a.x, a.y, { steps: 6 });
      await pause(page, 120);
      await page.mouse.down();
      await pause(page, 40);
      await page.mouse.up();
      await pause(page, 120);
    }
    await page.keyboard.up('Shift');
    await pause(page, 300);

    // Pre-hover to activate the arm's overlay.
    await page.mouse.move(ee.x, ee.y, { steps: 10 });
    await pause(page, 800);

    // === Recording starts. ===
    await ctrl.mark();
    await pause(page, 200);

    // Press, then sweep.
    await page.mouse.down();
    await pause(page, 150);

    // Arm SVG is at (80, 200) size 480×480. ViewBox 0 0 400 400, base at (200,300)
    // → page (320, 560). End-effector starts roughly at (~460, ~390).
    // Sweep around the base in an arc, well inside reach radius (~290 page px).
    const armArc: Array<[number, number]> = [
      [550, 380],
      [580, 460],
      [550, 540],
      [460, 600],
      [340, 610],
      [220, 580],
      [140, 510],
      [120, 410],
      [180, 320],
      [280, 280],
    ];
    for (const [x, y] of armArc) {
      await page.mouse.move(x, y, { steps: 5 });
    }
    await page.mouse.up();
    await pause(page, 300);

    // ===== Bezier interaction =====
    // Drag the 50% sample point straight downwards. With the 25% and 75%
    // points pinned, the arch is forced to flip: the middle dips below the
    // locks, then below the original endpoints — a satisfying inversion.
    const mid = anchors.mid;
    await page.mouse.move(mid.x, mid.y, { steps: 8 });
    await pause(page, 250);
    await page.mouse.down();
    await pause(page, 100);
    // Pull straight down. The bezier SVG is 480 px tall; ~320 px of vertical
    // travel pushes the midpoint past the bottom of the original arch.
    const flipSteps: Array<[number, number]> = [
      [mid.x, mid.y + 60],
      [mid.x, mid.y + 140],
      [mid.x, mid.y + 220],
      [mid.x, mid.y + 300],
      [mid.x, mid.y + 340],
    ];
    for (const [x, y] of flipSteps) {
      await page.mouse.move(x, y, { steps: 6 });
    }
    await pause(page, 250);
    await page.mouse.up();
    await pause(page, 400);
  },
);

console.log('parametric-svg clip saved →', import.meta.dir);
