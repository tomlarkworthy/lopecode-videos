# parametric-svg clip

Two of the parametric-svg notebook's interactive cells side-by-side, both
driven simultaneously by the reactive runtime:

- **Left**: the robot arm with its three theta sliders. Dragging the
  end-effector solves the inverse kinematics; the sliders animate in
  lockstep — that's the headline story.
- **Right**: the cubic Bezier with the **25% and 75% curve sample points**
  pre-locked via shift+click. Dragging the **50% point straight downwards**
  forces the arch to flip — the original endpoints float up, the locks stay
  put, the curve inverts.

The sliders moving in tandem with the arm drag is the *coolest* part —
keep them in frame. They are the visible parameter vector `q` that the
notebook's math formula refers to.

## Why we composite from one notebook

The newsletter only embeds the arm. The bezier lives in the parametric-svg
companion notebook. We want both on screen at once for information density,
so the URL targets `@tomlarkworthy/parametric-svg` directly (not the
newsletter) and the clip uses CSS `position:fixed` to pin the cell wrappers
into a side-by-side layout. The cells stay bound to the same reactive
runtime; only the visual layout changes.

Lopepage refuses to mount the same module name in two panes — it
deduplicates. So `R100(@m,@m)` collapses to a single pane. We do the
side-by-side ourselves.

## Trap: pin the cell wrapper, not the SVG

Each parametric SVG cell *replaces* its SVG node on every parameter change
(reactive re-render produces a fresh `<svg>` element). If you
`position:fixed` the SVG itself, the next render drops a new SVG back into
the original DOM position and your composition collapses on the first
drag.

Pin the `.observablehq` mount wrapper instead — the cell re-renders into
that wrapper. A `MutationObserver` re-applies width/height attributes on
the replaced SVG so it keeps filling the wrap.

## Trap: don't `visibility:hidden` the body children

The svgEditor overlay (`position:fixed` z=2147483647) is appended directly
to `<body>` during cell init. If you sweep `visibility:hidden` across all
`document.body.children` (a tempting way to hide the rest of the
notebook), you also hide the overlay — even when its own style is
`pointer-events:auto`. Then pointer events never reach the drag handler,
the arm doesn't move, the screencast captures only a couple of static
frames (visible as a clip with 0.2 s duration — a sub-second clip here is
the symptom of a broken drag, not a pacing issue).

Use an opaque `position:fixed` backdrop with z-index between the
underlying page and the pinned cell wrappers. The overlay stays untouched.

## Trap: the arm anchors are below the viewport in the parametric-svg notebook

On the standalone parametric-svg notebook (no lopepage frame), the robot
arm's `end-effector` anchor lives at page-y ≈ 932. The Playwright viewport
is 1280×720, so a `page.mouse.move` to that y silently misses — the
choreography appears to run, the drag never engages. The composition
solves this by pinning the arm wrap to `top:200` which puts the
end-effector around y ≈ 390, well within reach.

If you ever need to film without compositing (e.g., a direct
parametric-svg shot), scroll the cell into view first.

## Locking endpoints before recording

Shift+click on a bezier control anchor toggles a lock indicator (yellow
ring). We do the two shift+clicks *before* `ctrl.mark()` so the locked
state is established when the recording starts — the viewer sees the
yellow locks from frame 1 and immediately understands "those won't move."

## Pacing knobs

- Pre-hover settle: 800 ms (lets the svgEditor overlay activate and the
  rAF tick sync to the new SVG rect).
- Inter-waypoint: `steps: 5` per mouse-move, no extra pauses → smooth glide.
- Hold after arm release: 300 ms before pivoting to bezier.
- Hold at end: 400 ms.

Current clip: ~3.7 s. If it feels too long, halve the arm arc waypoints —
the sweep stays legible because each pose change is still bigger than
viewer reaction time.

## The bezier flip

The clip locks two **curve sample anchors** (the `curve-${t}` ones, not
the `cp-pN` control anchors) at t ≈ 0.27 and t ≈ 0.73 — the closest grid
points to 25 % and 75 % with `bezierSamples = 10` (sample positions are
`(i+1)/(bezierSamples+1)`).

Dragging the t ≈ 0.5 sample point straight down by ~300 px (most of the
SVG height) forces the curve to invert: the original endpoints (which are
*not* locked) float upward as the solver tries to keep the locks honoured
while the middle plunges. The visual goes from a U shape (concave up) to
an inverted U (concave down).

If the flip stops short / pops back, the lock-points are too close to the
endpoints — there isn't enough range for the middle to undercut them.
Use ~25 % / ~75 % rather than ~10 % / ~90 %.
