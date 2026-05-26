# intro clip

Title card for the newsletter. ~4.9s. Unlike every other cut, this one
is **not** a live notebook — it's a self-contained CSS/SVG scene
(`intro.html`) captured through the same `capture.ts` harness.

## Beat sequence

The backdrop (sun, neon horizon, scrolling grid floor, stars, PC) is
rendered at full opacity from frame 1 — there is **no fade-in**. The clip
opens on the finished neon scene with the disk presented over the screen,
then **dives straight into the insertion** — no opening pause on the
static disk (`--t-insert:0`, clip.ts holds only ~120ms before `.playing`).

| t (s) | beat |
|-------|------|
| 0.0   | full neon scene (sun, horizon, grid floor, stars, PC) with the lopecode brand disk + biro label presented over the screen |
| ~0.12 | disk dives straight in — descends + tips to near-horizontal, arrives flat at the slot, pushes straight in (clipped at slot) |
| ~0.9  | drive LED lights red |
| ~1.05 | CRT power-on (scaleY flash + glow ramp) |
| ~1.35 | dolly into the screen (scene `transform: scale`) |
| ~2.5  | `RUN NEWSLETTER-001` typed at the `]` prompt, char by char |
| ~3.8  | Enter — prompt drops to a fresh line |
| ~4.1  | hold |

## Cyberpunk backdrop

`.bg` (radial sky) + `.bg::after` (glowing neon horizon line) + `.stars`
(tiled radial-gradient dots, masked to the sky) + `.sun` (retrowave disc
with `::after` dark scan-slits on its lower half) + `.grid` (perspective
neon floor that scrolls toward the viewer via `gridScroll`). The sun is
sized larger than the monitor so its cap rises above the bezel and its
glow halos around the PC — most of the disc is deliberately behind the
PC. Resize/reposition the sun and the horizon (`top:`) together if you
move the floor.

## Why CSS/SVG, not a notebook

The disk/PC/CRT don't exist as a notebook, and AI video-gen isn't in the
pipeline. A hand-coded scene is deterministic, re-recordable from one
file, and composites pixel-identically with the other 12 cuts (1280×720,
dpr 2, H.264 CRF 18).

## 3D insertion

Two beats in `diskInsert`: (1) the disk descends from over the screen
(`top` 150→390) while tipping forward to near-horizontal (`rotateX`
0→−90° under `perspective(440px)`), so it arrives lying flat right at
the slot, shutter/top edge leading; (2) it pushes straight back into the
machine (`translateZ` −200px). The **`.disk-clip` wrapper** (an
`overflow:hidden` box whose bottom edge sits on the slot line, stage
y≈498) cuts it off in *screen space* as it goes in — physically
swallowed, **opacity stays 1** (a fade reads as a ghost, not insertion).

Why this shape: a slot is horizontal, so the disk has to lie flat to
enter it. Tipping to near-horizontal aligns it with the slot and sends
the shutter edge in first; the clip then eats it at the opening.

Tuning:
- The clip line is `.disk-clip { height }`. It must equal the slot's
  stage-y. Move it with the drive/slot or the disk vanishes off the lip.
- The final `top` + `rotateX(−90)` should land the flattened disk just
  below the clip line so it's gone before the CRT powers on
  (`--t-power`). Don't flatten it early/high or it reads as a pancake
  hovering over the screen instead of entering the slot.

## The disk is the real brand mark

`.disk-svg` is `disk_svg` lifted verbatim from `@tomlarkworthy/exporter-3`
— the same SVG used as the notebook favicon (`diskDataUrl`). Filled
off-white with a cyan+magenta `drop-shadow` neon halo. **If the favicon
ever changes, update the inline `<svg>` in `intro.html` to match.** The
handwritten label is a separate paper "sticker" div laid over the face,
not part of the icon (the icon's own label area is too small for text).

## Timeline lives in the page, not the choreography

All motion is CSS keyframes kicked off by `body.playing`, with
`animation-delay` set from the `--t-*` custom properties at the top of
`intro.html`. The `RUN` typing is JS `setTimeout`s relative to the same
anchors. `clip.ts` only: sets `__captureMode` (suppresses auto-play),
reloads, `mark()`s, calls `window.startIntro()`, waits `TOTAL_MS`.

Consequences:
- **To retime a beat, edit the `--t-*` vars (and the JS `T` mirror) in
  `intro.html`**, not `clip.ts`. Then bump `TOTAL_MS` in `clip.ts` if the
  last beat moved.
- Open `intro.html` directly in a browser to preview — it auto-plays
  after 400ms when `__captureMode` is unset.

## Known framing notes

- Screen font is 18px so the `64K RAM SYSTEM  38911 BYTES FREE` line fits
  inside the 2.55× zoom. If you re-zoom tighter, shrink the font again or
  the right edge clips.
- The biro font resolves to `Bradley Hand` → `Marker Felt` on macOS. On a
  machine without either it falls back to `Comic Sans MS`/cursive — fine
  for a placeholder but check before final render on another box.
- The disk deliberately floats in front of the (still-off) screen during
  the label beat; that's the "presenting the disk" staging, not a layer
  bug.

## Opening: full scene from frame 1, no fade-in

Everything — backdrop (`.bg`, `.sun`, `.stars`, `.grid`), `.pc`, and the
disk + biro label — is default CSS at `opacity:1`/its resting state, so
frame 1 is the finished neon scene with the disk presented over the
screen. `.playing` drives only motion (grid scroll, disk insert, power-on,
dolly), not opacity fades. This makes a vivid thumbnail and saves the ~2s
the old backdrop fade-in cost.

The unstyled-first-frame flash this risks (page paints unstyled →
everything visible → black → fade) is dodged because `clip.ts` reloads and
holds 300ms *before* `mark()`, so any flash happens pre-capture.

History: an earlier version opened on the bare disk on black and faded the
backdrop in around it (`fadeIn`/`sunIn`/`gridIn`/`pcIn` keyframes, disk
insert at `--t-insert:2000ms`). Then it opened on the full scene but held
the presented disk ~1s before inserting (`--t-insert:700ms` + a 300ms
clip.ts pre-roll). Both were dropped to dive straight in: `--t-insert:0`,
clip.ts pre-roll ~120ms, and all downstream beats shifted ~700ms earlier
(`--t-power` 1750→1050, `--t-zoom` 2050→1350, JS `T` 1750/3200→1050/2500,
LED delay 1600→900). To restore an opening hold, push `--t-insert` back out
and shift the rest with it.

The label is static — an earlier left-to-right "write-on" (clip-path
reveal + a pen tip riding the edge) looked janky, so it was removed. The
disk reads as "already labelled, ready to insert." `clip.ts` holds only
~120 ms on the disk alone before `startIntro()` — just a glimpse, then it
dives in.

## Lessons from authoring this clip

Hard-won, mostly from getting the slot insertion to look physical:

- **A slot is horizontal, so the disk must lie flat to enter it.** Early
  versions slid the disk down through the slot while it stayed vertical —
  that always goes in *bottom-edge-first* (whichever edge is lowest on
  screen crosses the slot first). You cannot fix lead-edge by flipping
  the `rotateX` sign: sign only changes foreshortening, not which edge is
  lowest. The fix is to tip the disk to **near-horizontal** so it aligns
  with the slot and the shutter edge leads.
- **Clip it, don't fade it.** Fading opacity to 0 reads as a ghost
  dissolving, not an object going in. Use an `overflow:hidden` wrapper
  (`.disk-clip`) whose bottom edge sits on the slot line so the disk is
  cut off in *screen space* regardless of its 3D transform. Opacity stays
  1 the whole time.
- **`translateZ` order matters.** Put it *before* `rotateX` in the
  transform list (world-space depth). After `rotateX` it translates along
  the tilted local axis and the disk drifts down out of the slot onto the
  "floor" instead of receding straight back.
- **`perspective()` strength = how much trapezoid.** A large value
  (~1100px) looks orthographic/flat ("falling card"); a small value
  (~440px) gives the strong receding-trapezoid foreshortening. The user
  wanted "trapezoid, not a pancake."
- **The disk is large relative to the gap below the slot.** Presenting it
  over the screen (above the slot) and inserting it can't both be
  satisfied by simple up/down translation — hence the descend-while-
  tipping move that carries it from the presentation spot down to the
  slot.
- **Verify geometry with cropped, upscaled frames.** The slot region is a
  small part of 1280×720; a full-frame grab renders too small to judge.
  Crop+scale the lower-centre and inspect:
  `ffmpeg -ss <t> -i intro.mp4 -frames:v 1 -vf "crop=720:430:280:200,scale=720:430" out.png`
- **Keep the JS `T` anchors in sync with the CSS `--t-*` vars.** The
  typing timeline (`T.power`, `T.type`) is independent of the CSS
  keyframe delays; they must agree or text appears before the CRT is on.
  Lengthening the typed command (`CMD`) pushes the Enter beat later — bump
  `TOTAL_MS` in `clip.ts` to keep the hold.

## Re-record

```bash
bun content/newsletter-001/clips/intro/clip.ts   # or: bun run clip:intro
```
