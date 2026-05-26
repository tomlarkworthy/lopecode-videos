# pdf-tab clip

Start on the newsletter's **Native browser tabs** section. Click the
"Try it:" aside link (`lopecode-newsletter-001/sample.pdf`) and a PDF opens
in a side pane. The payoff frame is the prose + link on the left and the
**full-page** colorful "Printer Test Page" rendered on the right.

Story: lopepage can open any file attachment (PDF, video…) in a pane, not
just notebooks/modules.

## How the aside link works

The `aside('…')` helper renders `<a href="#view=R100(@newsletter,S50(@…))">`.
Clicking it sets the hash, lopepage splits into two panes, and the second
is the `sample.pdf` attachment shown through the browser's native PDF viewer
(an `<iframe>` whose `src` is a `blob:null/<uuid>` URL).

## Trap: the PDF render is slow and not reliably captured live

1. The native viewer fetches the attachment, builds a blob, and parses it —
   ~2–3 s to first colorful paint.
2. The render happens **inside an iframe**, and the top page doesn't reliably
   emit CDP screencast frames for iframe-internal paints — so the colorful
   page often never lands in the recording even if you wait.

Fix: **pre-warm**. Before `mark()`, set the hash to the two-pane view, wait
~3.5 s for a full render, then set it back to single-pane. This warms PDF.js
and the attachment bytes; the recorded click then renders fast enough to be
captured.

## Full page, not "print preview": rewrite the iframe with viewer params

By default the native viewer shows a toolbar + thumbnail sidebar ("print
preview" look). Chrome's PDF viewer honours fragment params on the iframe
`src`: `#toolbar=0&navpanes=0&scrollbar=0&view=Fit` → just the fitted page.

Two gotchas:
- A **fragment-only** change on an already-loaded iframe is a no-op (no
  reload), so the params never apply. You must force a genuine reload —
  bounce `src` through `about:blank` then set `base + params`.
- Do it at **insertion time**, before the chrome-ful viewer paints, or you
  get a flicker (toolbar appears, then vanishes on reload).

Implementation: a `MutationObserver` on `document.documentElement` watching
for any `<iframe src="blob:…">`. On match: `src='about:blank'`, then on the
next rAF `src = base + '#toolbar=0&navpanes=0&scrollbar=0&view=Fit'`. Guard
with a `data-pdfFixed` flag so it runs once per iframe. Install it BEFORE the
pre-warm so the warm path also loads with params.

## Trap: left pane jumps on the 100%→50% reflow — anchor the heading per frame

When the left pane shrinks from full width to half, it reflows (narrower =
taller) and lopepage resets its scroll → a visible jump down to a later
section ("Embedded Linux?") and back.

What does NOT work: locking a fixed-pixel `scrollTop` — the heading's pixel
offset changes when the column reflows, so the lock pins the wrong content.

What works: re-anchor to the **heading element** every animation frame for
the ~1.5 s relayout window:

```ts
const tick = () => {
  h.scrollIntoView({ block: 'start', behavior: 'instant' });
  raf = requestAnimationFrame(tick);
};
raf = requestAnimationFrame(tick);
setTimeout(() => cancelAnimationFrame(raf), 1500);
```

`scrollIntoView` re-finds the heading's true position each frame, so it
tracks through the reflow with no visible jump.

## Pacing

- Lead-in after `mark()`: ~500 ms on single-pane prose (cursor is invisible,
  so pre-click motion is dead air — keep it short).
- Click → reveal → ~1.5 s heading-anchor hold → final beat.
- Current clip: ~2.5 s. The screencast stops emitting frames once the page is
  static, so the encoded clip ends at the last paint; for a longer hold on
  the final PDF frame, freeze the last frame in post.

## Files

- `clip.ts` — choreography (pre-warm + iframe-param observer + click +
  per-frame heading anchor).
- `scout.ts` — finds the link, clicks, screenshots before/after to
  `/tmp/pdf-{before,after}.png`. Re-check link text/href if the newsletter
  changes.
- `probe-pdf.ts` — opens two-pane, rewrites the PDF iframe with viewer params
  (about:blank bounce), screenshots `/tmp/pdf-params-{before,after}.png`.
  Use to re-confirm the params still give a clean full-page render.

This clip uses `capture()` (CDP screencast → H.264 mp4), NOT `captureStills()`.
