# history clip — PARKED

This cut is parked. The persistence story is hard to show visually in a 5-second
slot — most of the on-screen time is invisible plumbing (IndexedDB commit
write, reload, replay) with no motion the viewer can follow. The interesting
beat (edit → reload → edit survives) takes ~15-20 s of real time to play out
because the IDB write and the post-reload replay are both several seconds
each, and neither produces moving pixels while it runs.

If we come back to this:

## What worked

Editing the **newsletter's `### Local change history` H3** (inside a
`.lope-editable-md` wrap) and committing with Shift+Enter — that fires
`compile_and_update`, the change_listener appends to `history`, and
`commit_history` writes the git commit to IndexedDB. Reload then replays
correctly. Earlier captures of this version are buried in git history; the
shape was: open editor → Meta+A → type `` md`### new heading` `` →
Shift+Enter → poll IDB for commit → reload → poll DOM for replayed heading
→ scroll into view.

## What blocked the latest iteration

User asked to edit the **right-pane H1 "Local Change History"** (the
local-change-history module's own title) instead. That cell sits in a
`.observablehq` wrap, *not* `.lope-editable-md`. After the switch:

- Shift+Enter no longer fired `compile_and_update` — IDB count stayed at 3
  forever (commit never happened). Subsequent reloads naturally replayed
  nothing.
- Clicking the per-cell "close" hotbar also discards the buffer (already
  documented) — but with `.observablehq` cells it appears to revert the
  *committed* value too, not just the editor buffer. Don't use it as a
  cleanup step here.

The underlying difference between `.lope-editable-md` and `.observablehq`
editor handling needs more investigation before this clip is viable on the
right pane.

## Traps that are still good notes if/when this comes back

- editor-5 compiles the cell as JS — bare markdown is a syntax error. Keep
  the `` md`...` `` wrapper.
- The lightning-fs IDB store grows from 3 → ~10 keys when a commit lands.
  Poll until stable before reloading; a fixed `pause` is racy under CDP
  screencast load.
- Two-pane scrolls happen on the `.lm_content` ancestor, not the document.
- After reload, lopepage restores scroll to wherever it remembered last —
  often the Kiki section. Re-scroll on the polled-found heading and keep
  re-scrolling for a few iterations to override the late restore.

## Files

- `clip.ts` — the parked attempt (right-pane H1 target).
- `history.mp4` — last capture, persistence punchline does NOT land
  (heading reverts after reload). Keep as evidence of where this got stuck.
