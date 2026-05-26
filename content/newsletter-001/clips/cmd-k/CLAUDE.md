# cmd-k clip

The command palette as a workspace-wide jump-to-source. Two jumps:

1. Newsletter, scrolled to the **CMD + K Command bar** section (the prose
   that names the feature is on screen).
2. **Cmd+K → `pal` → Enter** jumps to the command-palette module's *own*
   page ("Press Cmd+K to open", plugin API docs) — the feature documenting
   itself. Nicely self-referential.
3. **Cmd+K → `rob` → Enter** jumps to the `robotArm` cell source — the
   inverse-kinematics forward function. The IK code is the payoff and it
   ties back to the video's hook (the robot arm). Per-keystroke search shows
   live source previews with the match highlighted; that's the feature.

## Why these queries (and only three letters)

Don't type the full name — the palette re-ranks on every keystroke, so the
right hit floats to the top after a few letters. Typing `pal`/`rob` and the
target appearing instantly *is* the autocomplete story; full names just add
dead typing time.

- `pal` (3 chars) ranks `@tomlarkworthy/command-palette` top with an
  **"open module"** action → lands on its self-documenting page (meta beat).
- `rob` (3 chars) ranks `robotArm` (parametric-svg) top — dense, recognisable
  code (trig, `L1/L2/L3`) that rhymes with the opening robot-arm hook. The
  list also shows matches across multiple notebooks, selling "searches the
  whole workspace."

## Gotchas

- **Focus steals the keystroke.** Cmd+K is a global `document` keydown
  handler (capture phase), but if a cell editor is open/focused it eats the
  key. Setup closes any `.hotbar` "close" toggles, blurs `activeElement`,
  and focuses `<body>` before recording.
- **Enter changes notebooks.** Opening `robotArm` sets the hash to
  `…&open=@tomlarkworthy/parametric-svg#robotArm`, which opens a *second
  tab* and switches to it. Expected — it's the cross-notebook jump.
- **The jump lands on the cell OUTPUT, not its source.** The cell renders
  output (the SVG) on top, then the `inputs:` line, then the CodeMirror
  source below the fold. You must `scrollIntoView` the source to frame it.
  Targeting the specific `.cm-line` containing `L1 = 100` with
  `block:'center'` frames the IK declarations from the top.
- **The editor height settles for ~1s after mount** (CodeMirror lazy-renders
  lines; the output above resizes), so the final framing drifts a little
  during the hold. Harmless — source stays readable throughout.
- **Jump 1 boots the command-palette page fresh** (~0.5s blank on first
  open). We `waitForFunction` for its `<h1>` after Enter so the hold doesn't
  land on a blank frame. parametric-svg (jump 2) is already a newsletter
  dependency, so it mounts instantly — no wait needed there.

## Pre-warm pitfall (don't)

Tried pre-mounting the command-palette tab during setup (via `open=` hash)
then switching back, to make jump 1 instant. Two ways it broke:
- `location.hash = '#view=R100(@newsletter)'` to return *destroys* the
  command-palette tab (full layout rebuild), so the warm is wasted.
- Switching back by clicking the `.lm_tab` keeps the tab, but a focused
  input on the command-palette page (a kiki REPL cell) then captured the
  recorded keystrokes — `command-palette` got typed into the REPL, not the
  palette. Blur didn't reliably clear cross-tab focus.

`waitForFunction` after the jump is the robust fix; the brief load is hidden
because we only hold once content exists.

## Pacing (current ~7.2s, two jumps)

Two search+jumps. Three-letter queries (vs full names) cut ~2s. Still over a
single 5s slot; if it must fit one, drop to the single `rob`→robotArm jump
(~4.2s) or split into two cuts. Compressible beats: the two results-read
pauses (700/750 ms) and the final hold (1100 ms). The screencast timeline
stretches relative to wall-clock because static palette-open periods emit few
frames (long per-frame durations).
