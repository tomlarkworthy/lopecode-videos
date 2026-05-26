# outro clip

End card for the newsletter. ~6.0s. The **intro played in reverse** — it
shares the intro's scene (`intro.html`) almost verbatim; `outro.html` only
changes the default states and the `.playing` animations. Like the intro,
it's a self-contained CSS/SVG scene captured via `capture.ts`, not a notebook.

## Loop with the intro

Both clips now begin and end on the **full neon scene** (the backdrop is
never faded in or out), so the seams roughly match for a loop:

- **outro first frame ≈ intro last frame** — zoomed into the lit CRT showing
  `] RUN NEWSLETTER-001`.
- **outro last frame ≈ intro first frame** — the full neon scene with the
  disk presented over the screen. Caveat: the CRT is *on* at the outro's
  end (it never powers off) but *off* at the intro's start, so the screen
  content differs across this seam. Acceptable for the rough cut; the
  priority was a shorter clip, not a frame-perfect loop.

If you retime either clip, re-check both seam frames.

## Beat sequence

| t (s) | beat |
|-------|------|
| 0.0   | zoomed into the CRT, `] RUN NEWSLETTER-001` (matches intro's end) |
| 0.7   | program prints `NEWSLETTER-001 COMPLETE` |
| 1.25  | prints the link `github.com/tomlarkworthy/lopecode`, holds to be read |
| 3.3   | dolly back out (`dolly` reversed); CRT stays on, link still showing |
| 4.5   | disk ejects (`diskInsert` reversed) — rises out of the slot, tips back to vertical |
| ~5.5  | disk settles over the screen; clip ends right here (TOTAL_MS 5650) — a brief loop-point frame, no lingering on the ejected disk |

The CRT is **never powered off** — a dark screen against the synthwave
backdrop read oddly, so it stays lit (link visible) for the whole clip.
The backdrop is also **never faded out** (an earlier version faded
everything to black at `--t-fadeout:5400ms`, leaving the bare disk); that
was dropped to end on the full scene and shorten the clip.

## How the reverse works

The scene defaults (in `outro.html`'s CSS) are set to the intro's **end**
state: `.scene` `scale(2.55)` (zoomed), `.screen` on, `.bg/.sun/.stars/.grid/
.pc` opacity 1, `.led` lit. The disk defaults to `opacity:0` — it's *inside*
the machine at the start (inserted during the intro), so it must not show
until the eject. Then `.playing` undoes the zoom and insertion (it does
**not** fade the backdrop out — the clip ends on the full scene):

- **Eject** and **zoom-out** reuse the intro's exact `@keyframes diskInsert`
  and `dolly` with `animation-direction: reverse` — a true reverse, no second
  copy to keep in sync. `diskInsert` reversed needs `fill: both` (during the
  delay it holds the 100%/inserted frame). A 1ms `ejectShow` flips the disk's
  `opacity` 0→1 exactly at `--t-eject` so it's invisible until it ejects (the
  `diskInsert` keyframes don't touch opacity, so it's controlled separately).
  `dolly` reversed uses `forwards` (default scale 2.55 holds through the delay).
- **ledOff / ejectShow** are outro-only keyframes. The eject is the last beat;
  the clip then holds on the full neon scene with the disk resting over the
  screen.
- The `.disk-clip` slot-clip wrapper (see intro CLAUDE.md) is unchanged, so
  the disk emerges *out of* the slot exactly as it went in.
- There is **no power-off** and **no fade to black** — the CRT and the whole
  backdrop stay lit through the final hold.

## The on-screen link

Shown as `github.com/tomlarkworthy/lopecode` — the `https://` is dropped so
the full link fits the retro ~40-column screen at the intro's 18px font
without clipping at the zoom. The screen has room below the `RUN` line for
the two extra lines, so no scrolling is needed (they print in view).

## Lessons from authoring this clip

- **A reverse clip = swap the defaults, replay the keyframes reversed.**
  Don't author a separate "eject" or "zoom-out" animation. Set each
  element's *default* CSS to the source clip's **end** state, then drive
  the forward `@keyframes` with `animation-direction: reverse`. Eject reuses
  `diskInsert`, zoom-out reuses `dolly`. One source of truth; retiming the
  intro's motion retimes the outro's for free.
- **Reversed animation fill modes are unintuitive.** With `reverse`, the
  playback *first* frame is the keyframe `100%` and the *last* is `0%`. So
  `fill: both` holds `100%` during the delay (here: disk inserted/clipped)
  and `0%` after (disk at rest). Use `forwards` when the element's plain
  default already equals the during-delay state (zoom: default `scale(2.55)`
  holds, no `both` needed).
- **A property not in the keyframes isn't animated — control it separately.**
  `diskInsert` only animates `top`/`transform`, never `opacity`. To keep the
  disk hidden (it's *inside* the machine) until the eject, the disk defaults
  to `opacity:0` and a 1ms `ejectShow` flips it to 1 at `--t-eject`. Trying
  to hide it via the shared keyframes would have meant editing the intro's.
- **Mind what's visible in the *zoomed* frame.** The disk at its resting
  `top:150` sits inside the 2.55× zoom band, so a "hidden" disk with default
  `opacity:1` showed *over the screen* in the opening frame. The zoom crops
  to ~scene-y 159–441; anything in that band paints even though the wider
  composition implies it's off to the side.
- **A powered-off CRT against a bright backdrop reads as broken, not off.**
  The synthwave backdrop stayed lit while the screen went black — looked like
  a render bug. Leaving the CRT on (and letting it fade out with the PC) was
  cleaner. Not every intro beat needs a literal reverse.
- **Retro screens are ~40 columns.** `https://github.com/tomlarkworthy/lopecode`
  (41 ch) overflows the screen width at the intro's 18px font; dropping
  `https://` (33 ch) fits with margin and keeps the font matched to the intro
  (so the intro→outro seam doesn't jump). Shrinking the font instead would
  have forced a matching change in the intro.
- **Verify both loop seams as frames.** outro-first ≈ intro-last
  (the RUN screen) and outro-last ≈ intro-first (the full neon scene with
  the disk presented over the screen). Grab those four frames and eyeball
  them after any retiming. Note the seam is no longer frame-perfect (CRT on
  at outro-end vs off at intro-start) — see *Loop with the intro* above.

## Re-record

```bash
bun content/newsletter-001/clips/outro/clip.ts
```
