# themes clip

Cycle through every theme in `@tomlarkworthy/themes` while both panes —
the newsletter (left) and the themes notebook's swatch preview (right) —
recolor in lockstep.

## Style intent

A **series of stills, one per theme**, each labelled by the dropdown text.
The viewer should be able to pause on any moment and see a coherent
(label ↔ colors) pairing.

The story isn't *the transition between themes*; it's *the variety of
themes*. So the editing target is: hold each theme for a short, equal
beat, then cut hard to the next.

## Capture approach: stills, not video

We use `captureStills()` from `src/capture.ts` instead of `capture()`.

Rationale: each theme's CSS bundle is fetched over the network the first
time it's selected (~300-600 ms). In a recorded video that lag appears as
a smear between the label change and the recolor — the viewer sees
"label X with old theme's colors" for half a second. The post-processing
fix (find settled timestamps, cut stills, reconcat) is fiddly and breaks
when timing changes.

Stills mode avoids the lag entirely: the choreography waits 1500 ms
after each dispatch for the recolor to fully land, then
`ctrl.takeStill()` writes a PNG. After the choreography ends, the PNGs
are assembled into a slideshow at the configured `stillDurationSec` per
frame.

Result: every frame is a clean settled state. Cache warming, network
timing, and CSS load order stop mattering.

## Tweaking pace

Two levers: how many themes, and how long each still holds.

- **Count:** the loop shows *every other* theme (`i % 2 === 0`) → 7 of 13,
  which halves the clip. The full 13 ran ~2× the quickfire slot. To show all,
  iterate `0..themeNames.length`; to thin further, widen the step.
- **`stillDurationSec`** (default 0.4): 7 themes × 0.4s ≈ 3.2s. Faster
  (0.25-0.3s) feels more quickfire-paced.

Every-other was chosen over the alphabetical first-half so the cut keeps the
full light→dark spread (the story is *variety*).

## Cycle order

Themes come from `select.options` in alphabetical order:

```
air, coffee, cotton, deep-space, glacier, ink, midnight,
near-midnight, ocean-floor, parchment, slate, stark, sun-faded
```

The clip currently shows every other one: air, cotton, glacier, midnight,
ocean-floor, slate, sun-faded. To re-order or filter differently (e.g., open
on `near-midnight` to match the newsletter's default theme), build a custom
index list in `clip.ts` instead of the `i % 2 === 0` filter.

## Notes for future re-records

- Dispatch on `document.querySelectorAll('select')[0]` (the newsletter
  pane's dropdown). The themes notebook's select on the right is bound
  through `Inputs.bind` for the value, but its rendered selected-text
  doesn't update when the other side changes.
- Editor-open state can persist between sessions. Setup sweeps any
  `.hotbar` toggles with text "close" and clicks them — that closes any
  open cell editor before the first still.
- 1500 ms is a comfortable margin for CSS fetch + paint; drop to 1000 ms
  if the recording is slow.
