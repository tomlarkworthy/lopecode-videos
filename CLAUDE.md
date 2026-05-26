# lopecode-videos

Video content for lopecode, captured by Playwright-driven browser automation.

## Layout

```
src/                                  framework only — no clip specifics
  capture.ts                          shared Playwright harness
content/
  <series>/
    script.txt                        narration + cut list for the series
    clips/
      <cut-name>/                     one directory per cut
        clip.ts                       Playwright choreography
        <cut-name>.webm               captured output (committed)
```

`src/` is for things that are useful across every clip: the launch/record
plumbing, helpers like `pause` and `glide`, future cursor overlay, future
concat tooling. Anything that references a specific notebook URL, selector,
or timing belongs in the clip directory, not here.

`content/` is for clip artifacts. Choreography (`clip.ts`) and captured
video (`*.webm`) live side-by-side so a clip is self-contained — you can
re-record a single cut by editing one file and running one command.

## Adding a clip

```bash
mkdir -p content/<series>/clips/<name>
$EDITOR content/<series>/clips/<name>/clip.ts
bun content/<series>/clips/<name>/clip.ts
```

## Where clip-specific knowledge belongs

Anything that's specific to *one clip* — its narrative intent, the
peculiar timing/network/DOM quirks of its target feature, the
post-processing recipe needed to make it look right, the key
frame timestamps inside the raw recording — goes in a
**nested `CLAUDE.md` inside that clip's directory**, next to
`clip.ts` and the `.mp4`.

`CLAUDE.md` at the root (this file) documents the framework and
tricks that apply to *every* clip. The per-clip `CLAUDE.md`
documents *this* clip.

When picking a clip back up later — to re-record after a change,
or to finish post-processing — read the nested `CLAUDE.md` first.

Skeleton:

```ts
import { capture, pause } from '../../../../src/capture.ts';

const URL = 'file:///…/notebook.html#view=…';

await capture(
  { url: URL, outDir: import.meta.dir, videoName: '<name>' },
  async (page) => {
    // choreography
  },
);
```

`outDir: import.meta.dir` keeps the video next to the script that produced
it. `videoName` becomes the stable filename; Playwright's random per-run
filename gets renamed on close.

## Conventions

- Fixed viewport 1280×720 across a series so cuts composite identically.
- Insert ~400ms beats between actions for visual breathing room.
- `page.mouse.move(x, y, { steps: 30 })` so cursor motion glides rather
  than teleports.
- Captures are silent; VO + music get composited in post.
- `*.webm` files are committed. If sizes grow past a few MB per clip,
  migrate to git-lfs (not yet needed).

## Why per-clip directories instead of `src/clips/`

A clip is choreography + output. Co-locating them means:

- The series content tree is the source of truth for what was made.
- Adding a series adds directories; the framework doesn't change.
- A re-record is one file edit and one command, with no cross-tree hunt.

## Direction

Notes from authoring clips. Update when you learn something new.

### Keep clips aligned with the newsletter

A clip for `<feature>` should be filmed on the cell that the newsletter
*talks about* that feature, in the newsletter notebook itself. Don't shoot
the feature in a different notebook just because it's easier — the viewer's
mental anchor is "this is what the newsletter says, here it is happening."

When the feature can't be demoed in-place (markdown cells, see below),
replace the cell body with the smallest JS that produces the effect, run
the demo, then leave without saving. The on-screen prose continues to
render the original markdown because editor-5 only writes back on
Shift-Enter, not on every keystroke.

A strong variant: put the newsletter section that *names* the feature in
one pane and the feature's **home module** in the other
(`R100(@newsletter,S50(@feature-module))`). The section is the caption; the
module is the live thing, with all its own documentation and widgets. The
exporter clip does this — "Exporter-3 Upgrades" prose left, the full
exporter-3 module (docs + Download UI) right.

### Film a live widget by opening its module as a pane

If a feature ships an interactive widget (exporter-3's Download UI, a view,
an editor), open that module as a lopepage pane and drive the widget there.
Don't reconstruct the widget by digging its function out of the runtime
(`__ojs_runtime._variables`, etc.) and re-mounting it — the pane renders the
real UI natively, with its surrounding docs, and no private-API poking. (An
early exporter cut mounted `exporter()` via runtime internals; opening the
module as a pane was strictly better.)

### Click the real control in QA before you fake around it

The genuine behaviour of an action is often a better shot than your plan.
Clicking the real exporter **Download** expanded an *export manifest* — every
bundled module + byte size — which sells "many modules → one file" for free.
Always exercise the real control in the QA browser and watch what paints; only
fake the parts the screencast genuinely can't capture.

### Faking browser/OS chrome the screencast can't see

CDP screencast captures **page content only** — not the download shelf, the
toolbar, tabs, or the OS. To show a download: swallow the real one with
`page.on('download', (d) => d.path().catch(()=>{}))` (so the click doesn't
hang), then stage a `position:fixed` pill (file icon + filename + size) that
slides up via a `transform` transition — a convincing download-shelf stand-in.
The same DOM-overlay approach fakes any chrome: a white-`opacity` flash to
imply a page (re)load, a card that expands to imply "opening a file", etc. Keep
everything that *proves* the feature real (the export, the persisted result);
fake only the chrome.

### Hash-URL routing to a specific cell

Lopepage supports `R100(@module#anchor)` to scroll a cell into view —
*but only when the hash is set via hashchange after boot*. On initial
`page.goto`, lopepage parses `module#anchor` as the whole module name and
shows a "Lost?" prompt.

Two ways that work:

```ts
// 1. Goto plain URL, then set hash via evaluate to trigger hashchange.
await page.goto(`${URL}#view=R100(@m)`);
await page.waitForTimeout(1500);
await page.evaluate(() => {
  window.location.hash = '#view=R100(@m#some-cell)';
});

// 2. Goto plain URL, find the heading, scrollIntoView.
await page.evaluate(() => {
  document.querySelector('h3#some-cell')?.scrollIntoView({ block: 'start' });
});
```

scrollIntoView is the more reliable primary; hashchange is nicer when
you want lopepage to do its own framing.

### LSP doesn't fire inside markdown templates

editor-5's `completionSource` walks up the syntax tree from the cursor
and bails if any ancestor is `String|Template|Comment`. Markdown cells
(`md\`…\``) put everything inside `Template`, so the completion popup
never appears — even inside `${ ... }` interpolations.

Workaround for a demo clip: replace the cell body with a JS expression
(`message = "hello LSP"\nInputs.r`). Don't Shift-Enter. The runtime
keeps the old value; the on-screen prose stays as-is; Escape leaves
the editor and the cell is unchanged.

This is arguably a bug worth filing (the Template guard should
special-case Interpolation), but the demo works around it cleanly.

### Targeting a cell's edit affordance

Each cell renders a `.hotbar` div with text "edit" directly below its
`.lope-editable-md` wrap. The button toggles to "close" while the
editor is open.

```ts
const editCoords = await page.evaluate(() => {
  const h = document.querySelector('h3#some-cell');
  const cell = h.closest('.lope-editable-md');
  const cellRect = cell.getBoundingClientRect();
  const bar = [...document.querySelectorAll('.hotbar')]
    .filter((e) => /\bedit\b/.test(e.textContent.trim()))
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .find((o) => o.r.top >= cellRect.bottom - 5 && o.r.top <= cellRect.bottom + 80);
  return { x: bar.r.x + bar.r.width / 2, y: bar.r.y + bar.r.height / 2 };
});
```

After clicking edit, the newly mounted `.cm-editor` for that cell is the
last visible one in the DOM (height > 40px, top in viewport).

### Mac keyboard shortcuts

Editor uses Mac chord conventions: `Meta+A`, `Meta+Z`, not `Control+`.
Playwright accepts `Meta+` literally.

### Discard-on-Escape

editor-5 only writes back on Shift+Enter via `compile_and_update`. Any
other exit (Escape, close button, walking away) discards the editor
buffer and the cell's runtime value is unchanged. This is useful for
demos: replace the cell body, capture the popup, Escape — no cleanup
needed.

### Playwright/chromium version match

Bun's auto-installer resolves the version from `package.json` ranges,
not from whatever Playwright is installed in a parent `node_modules`.
The resolved version may pin a chromium revision that isn't in
`~/Library/Caches/ms-playwright/`. Result: `Executable doesn't exist at
.../chromium-XYZW/...`.

Check installed revisions with `ls ~/Library/Caches/ms-playwright/` and
pin Playwright to a version that maps to one of them (each playwright
release has a `browsers.json` listing its chromium revision). For this
machine, `~1.59.0` maps to chromium-1217 which is installed.

### Don't rely on initial scroll position

The viewport opens wherever lopepage last left it, or wherever the hash
routes. Always start the choreography with an explicit position step
(scrollIntoView the target cell, set hash via hashchange) rather than
assuming the page is at the top.

### Global keyboard shortcuts vs editor focus

Shortcuts like Cmd+K (command palette) are registered as `document` keydown
handlers in the capture phase, so they fire from anywhere — *unless* a cell
editor (CodeMirror) or some other input is focused and swallows the key.
Before pressing a global shortcut in a clip, sweep open `.hotbar` "close"
toggles, `blur()` the `activeElement`, and `focus()` `<body>`. Otherwise the
keystroke (or worse, the text you type next) lands in the wrong input — e.g.
a query typed into a stray REPL cell instead of the palette.

### Type the minimum prefix into live-filtered inputs

The command palette (and any fuzzy finder) re-ranks on every keystroke. Three
letters usually float the intended hit to the top — typing the full name just
adds dead time and reads as if the tool can't search. Type the short prefix,
let the ranking land the hit, then Enter. The "few letters → right answer
appears" moment *is* the feature you're filming. Verify the prefix ranks the
target #1 first (a quick QA-browser check), since ties can reorder it.

### Wait for content after a navigation, don't fix-pause through a blank

Jumping to a not-yet-mounted notebook/tab (e.g. the palette's `open=@module`
cross-notebook jump) boots that page fresh — ~0.5s of blank. A fixed
`pause()` after the jump holds the camera on that blank. Instead
`page.waitForFunction(() => <landed content exists>)` then a short hold, so
the recording only lingers once there's something to see. (Modules that are
already a dependency of the current notebook mount instantly and need no
wait.)

### Don't pre-warm tabs to dodge a first-mount blank

Tempting fix for the above: mount the target tab during setup, switch back,
let the recorded jump be instant. It's fragile:
- Returning via a `view=` hash reset *rebuilds the layout* and destroys the
  tab you just warmed.
- Returning by clicking the `.lm_tab` keeps the tab, but a focused input on
  the warmed page then steals the recorded keystrokes, and `blur()` doesn't
  reliably clear focus across tabs.
`waitForFunction` after the jump is the robust choice.

### A jumped-to cell lands on its output; scroll to reach the source

Opening a cell (palette "open", `open=@m#cell` hash) scrolls to the cell but
frames its *output* — the source CodeMirror sits below the output and the
`inputs:` line. To land on the code, `scrollIntoView` a specific `.cm-line`
(match on a distinctive token) with `block:'center'`. Note the editor height
settles for ~1s after mount (CodeMirror lazy-renders lines; output above
resizes), so the final framing drifts slightly during the hold — harmless.

### Channel `history` is noisy

Pairing-channel `history` events fire on every runtime re-fulfillment,
not just user edits. If the `_definition` is identical to the previous
event, it's a recompute, not a change. Ignore unless the source string
actually differs.

### Use vision to find dead air

Playwright's cursor is invisible in CDP screencast frames. That means
any time spent moving the mouse or waiting for slow mount animations is
*dead air* in the recording — the viewer sees a static page. To find
it, sample frames after capture:

```bash
ffmpeg -y -i clip.mp4 -vf fps=5 /tmp/f_%03d.png
```

then view consecutive frames. Anywhere two adjacent frames are
identical for more than ~200 ms is a candidate for trimming.

### Push setup work behind `mark()`

If something has to happen on the page but isn't visually interesting
(opening an editor, scrolling, mounting widgets), do it *before*
calling `ctrl.mark()`. The recording starts cold, ready for the next
visible action.

Rule of thumb: the first frame of the recording should already look
like "the camera is rolling and something is about to happen,"
not "we're getting set up."

### Stills mode for stable, label-correct sequences

For clips that should look like a series of clean stills rather than a
recorded interaction — typically anything where a fetch or animation
introduces lag the viewer shouldn't see — use `captureStills()` from
`src/capture.ts` instead of `capture()`.

```ts
import { captureStills, pause } from '../../../../src/capture.ts';

await captureStills(
  { url, outDir: import.meta.dir, videoName: '<name>', stillDurationSec: 0.4 },
  async (page, ctrl) => {
    for (const state of states) {
      await applyState(page, state);
      await pause(page, 1500); // wait for the state to fully settle
      await ctrl.takeStill();
    }
  },
);
```

Each `takeStill()` writes a PNG. After the choreography ends, the PNGs
are concatenated into a slideshow video where every still is held for
`stillDurationSec`. There is no transition between stills — viewers see
clean cuts.

Use this whenever:
- The state change involves a network fetch (CSS bundle, image, JSON).
- The animation between states would distract from the comparison.
- You want viewers to be able to pause on any frame and see something
  coherent.

For everything else (interactive flows like LSP, drag, type), keep
using `capture()` with `ctrl.mark()` — the CDP screencast preserves
real-time motion.

### A suspiciously short clip means nothing painted

CDP screencast only emits a frame when the page *paints*. If an
interaction silently fails to do anything (a drag that never engages,
a click that misses), the page stays static, almost no frames fire, and
the encoded mp4 comes out a fraction of a second long. So treat a
sub-second `ffprobe` duration as a red flag that the choreography didn't
actually drive the UI — not as a pacing problem. Verify the effect
happened (read a slider value, diff two frames) before assuming the
capture pipeline is at fault.

### Filming a PDF (or any file attachment) opened in a pane

lopepage opens file attachments via `R100(@nb,S50(@nb/file.pdf))`, rendered
in an `<iframe src="blob:null/<uuid>">` through the browser's native viewer.
Three things bite when filming it (see the `pdf-tab` clip):

- **Slow + iframe-internal render.** First colorful paint is ~2–3 s, and the
  paint happens inside the iframe, which the top-page screencast doesn't
  reliably capture. **Pre-warm**: open the two-pane view during setup, wait
  for a full render, navigate back, then film the real open — warm caches
  render fast enough to be captured. (Unlike golden-layout *tabs*, where
  pre-warming is fragile, a file-attachment pane re-warms cleanly because the
  blob bytes + PDF.js are cached process-wide.)
- **"Print preview" chrome.** The native viewer shows a toolbar + thumbnail
  sidebar. Chrome honours `#toolbar=0&navpanes=0&scrollbar=0&view=Fit` on the
  iframe `src` to get just the fitted page — but a *fragment-only* change on
  an already-loaded iframe is a no-op, so bounce `src` through `about:blank`
  then set `base+params`. Do it at insertion time (a `MutationObserver` on
  `documentElement` catching `iframe[src^="blob:"]`) so the chrome-ful viewer
  never paints — otherwise you get a toolbar flicker.

### Re-anchor to the element, not a pixel offset, through a reflow

When a pane changes width (e.g. 100%→50% as a second pane opens), the column
reflows and the scroll position jumps. Locking a fixed-pixel `scrollTop`
makes it worse — the target content moved. Instead re-`scrollIntoView` the
**heading/element** you want framed, every animation frame, for the ~1.5 s
relayout window. `scrollIntoView` re-finds the element's true position each
frame so the pane stays pinned with no visible jump.

### Drag interactions need the target in the viewport

Playwright silently ignores `page.mouse.move` to coordinates outside the
viewport. A cell whose anchor sits below the 720px fold (e.g. page-y=932)
gets no events and never drags. Either scroll the target into view first,
or reposition it (see below). Always log/inspect the resolved target
coordinates and confirm `y < viewport.height`.

### svgEditor (parametric-svg) drag mechanics

The `@tomlarkworthy/parametric-svg` `svgEditor` is fiddly to drive:

- The visible joint/handle circles have `pointer-events:none`. Dragging
  goes through a separate `position:fixed` overlay SVG (z-index max) that
  is `display:none` until a `pointermove` over the target establishes the
  "inside" state. So you must **pre-hover** the target (a real
  `page.mouse.move` into it, then ~600-800 ms beat) before `mouse.down`,
  or the press lands on nothing.
- Synthetic DOM events (`dispatchEvent` of PointerEvent/MouseEvent) do
  **not** engage the drag — only Playwright's trusted `page.mouse.*`
  (CDP-injected) events do.
- Two anchor families: **control points** `cp-pN` and **curve samples**
  `curve-${t}`. The samples are sprinkled along the rendered curve at
  `t = (i+1)/(bezierSamples+1)`. For a "lock two points then deform"
  story, the curve samples at ~25 % / ~75 % give more dramatic
  inversions than the control-point endpoints (which are at t = 0 and
  t = 1 and so can't be straddled by the dragged point).
- Locking an anchor is Shift+click on it; do it before `mark()` so the
  yellow lock rings are visible from frame 1.

### Lopepage won't mount the same module twice

`R100(@m,@m)` or `R100(S50(@m),S50(@m))` collapse to a single pane —
lopepage dedupes by module name. You cannot get two independently-scrolled
panes of the same notebook this way. To show two distant sections of one
notebook side-by-side, compose them manually (next note).

### Composing two cells side-by-side

To frame two far-apart cells of the same notebook together, `position:fixed`
their wrappers into a left/right layout and lay a backdrop over the rest.
This works for *live interactive widgets too* — the parametric-svg clip
pins the arm, its three sliders, the bezier, and its samples slider all
into one frame, and drag still drives the reactive runtime.

Three gotchas, in the order you'll hit them:

1. **Pin the wrap, not the rendered node.** Observable cells re-render
   into a brand-new node on every value change. If you pin the inner
   SVG/element, the next reactive update drops a fresh node into the
   *original* DOM location and your composition collapses on the first
   interaction. Pin the stable `.observablehq` mount wrapper instead and
   let the cell re-render *into* it. Use a `MutationObserver` on the wrap
   to re-apply size attributes (`width`/`height`) to the freshly-rendered
   child:

   ```ts
   const mo = new MutationObserver(() => {
     const svg = wrap.querySelector('svg');
     if (svg) { svg.setAttribute('width', '480'); svg.setAttribute('height', '480'); }
   });
   mo.observe(wrap, { childList: true, subtree: true });
   ```

2. **Don't `visibility:hidden` body.children to dim the rest.** Many
   widgets append `position:fixed` overlays directly to `<body>` during
   init — svgEditor's drag overlay is a textbook example. Sweeping
   `visibility:hidden` over `document.body.children` hides those overlays
   too, and `pointer-events:auto` doesn't override an inherited
   `visibility:hidden`. Result: pointer events never reach the drag
   handler, the page never repaints, and the recording comes out
   sub-second long (see *A suspiciously short clip means nothing painted*).
   Use an opaque `position:fixed` backdrop with z-index between the page
   and your pinned wraps instead.

3. **Keep input controls in frame.** When the story is "drag this thing
   and a vector of parameters solves," the *parameters* are the
   punchline — pin the `viewof` slider cells next to the canvas. They
   animate in lockstep with the drag and make the reactive coupling
   visible. Inputs.range renders at ~360 px natural width; give each pinned
   slider wrap at least 480 px and stack them vertically to avoid
   overlap.

### Keep the pace snappy

Default pauses end up too long. For a quickfire-style clip:

- 100–200 ms between key actions, not 400 ms.
- ~150 ms after a state change before kicking off the next one — enough
  for the eye to register, no more.
- ~400 ms at most as a hold on the final frame — viewers can pause.
- Typing delay: 90–110 ms per keystroke reads as "purposeful."
  Faster (~50 ms) reads as automation; slower (~200 ms) reads as
  unsure.

The whole clip should compress until it feels *slightly* too fast on
first watch — that's usually right by the third watch, because the
viewer has now seen the surprise.

### Clips can span a page navigation

A choreography can click a link and keep recording on the page it lands
on. `capture()` re-arms the CDP screencast on every main-frame
`framenavigated`, so the navigation is just a continuous beat (a brief
load flash, then the new page). To make an in-frame navigation work:

- Rewrite the target link to a **local file** with the hash you want and
  `target="_self"` — newsletter external links are `target="_blank"` +
  GitHub Pages URLs, which would open a tab the screencast can't follow.
  Do this in setup before `mark()`.
- Then `page.mouse.click` the link and `page.waitForFunction(...)` on a
  DOM signal from the destination notebook before continuing.

See the `linux` clip (newsletter → linux-sbc emulator).

### Time-lapse a slow stretch in post, not in the capture

For a feature that takes real time but repaints throughout (a boot, a long
compute), capture at 1× and speed-ramp in post with an ffmpeg
`trim`+`setpts`+`concat` filter: intro and payoff at 1×, the boring middle
at N×. Boundaries are timestamps into the raw mp4; re-derive by sampling
`ffmpeg -i raw.mp4 -vf fps=1`. See `linux/postprocess.ts` for a reusable
3-segment template. This only works because the stretch actually repaints
— a genuinely idle page emits no frames and collapses to one held frame
(see "A suspiciously short clip means nothing painted").

### Pure CSS/SVG scenes (title/end cards)

Not every cut is a notebook. The `intro`/`outro` cards are hand-coded
CSS/SVG scenes (`intro.html`/`outro.html`) captured through the same
`capture.ts`. The harness doesn't care what's on the page, so the workflow
is identical: a JS-started timeline (`startIntro()`/`startOutro()`),
`__captureMode` to suppress the page's own auto-play, `mark()`, run, hold.
Author motion as CSS `@keyframes` gated behind a `.playing` class. See the
two clips' CLAUDE.md for the slot-clip, 3D-insertion, and FOUC lessons.

### Build a reverse/looping clip by swapping defaults, not re-animating

To make a clip that's another clip played backwards (e.g. `outro` = `intro`
reversed, so they loop): set each element's **default** CSS to the source
clip's *end* state, then replay the source's `@keyframes` with
`animation-direction: reverse`. No second copy of the motion — retiming the
original retimes the reverse for free. Gotchas: under `reverse` the playback
first frame is `100%` and last is `0%`, so fill modes invert (`both` holds
the `100%` frame during the delay); a property absent from the keyframes
(e.g. `opacity`) isn't animated, so control "hidden until X" with a tiny
separate keyframe; and verify **both** loop seams as actual frames
(reverse-first == forward-last, reverse-last == forward-first).
