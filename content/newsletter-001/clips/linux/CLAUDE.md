# linux clip

Newsletter "Embedded Linux?" section → (hard cut) → Linux 6.1 boot sequence →
`uname -a` prints `riscv32 GNU/Linux`.

The raw capture still rides the real newsletter → linux-sbc navigation and
clicks **Boot & Run** (needed to reach the boot), but `postprocess.ts`
**hard-cuts that whole transition** — the blank nav flash, the SBC notebook's
docs, and the "stopped / (no output yet)" pre-boot screen — so the deliverable
jumps from the newsletter straight into the streaming boot.

Two outputs:
- `linux.mp4` — raw capture (~23s, real-time boot, includes the SBC-open
  transition).
- `linux-final.mp4` — post-processed: SBC-open transition cut + boot middle
  time-lapsed (~6.7s). **This is the deliverable.** Re-run `postprocess.ts`
  after any re-capture (re-derive its timestamps — see its header).

## Pipeline

```bash
bun clip.ts          # capture → linux.mp4
bun postprocess.ts   # speed-ramp the boot → linux-final.mp4
```

## Why linux-sbc (not linux-emu)

linux-sbc has the nicer "graphic": a green-on-black scrolling terminal plus a
colored **mode-timeline** bar (M-mode red / S-mode yellow / User green / Idle)
that animates as the CPU changes privilege levels. linux-emu boots faster but
is visually plainer. The slow boot is fine — we time-lapse it in post.

## Navigation: screencast must be re-armed

The clip clicks a real link and the page navigates (newsletter →
linux-sbc.html). A CDP screencast **stops emitting frames on navigation**.
`src/capture.ts` now re-arms it on every main-frame `framenavigated`, so a
choreography can cross notebooks in one continuous take. Before that fix the
clip came out ~1.3s (only the pre-nav frames).

The link is `target="_blank"` + a GitHub Pages href in the newsletter. In
setup (before `mark()`) we rewrite it to the **local file** with a
single-pane hash and `target="_self"` so the click navigates in-frame:

```ts
link.href = `file://${SBC}#view=R100(@tomlarkworthy/linux-sbc)`;
link.target = '_self';
```

## Only ONE stretch is actually dead — don't over-speed

The boot is NOT uniformly slow. Most of it streams readable kernel messages.
There is exactly one dead stretch: the **initramfs unpack**, where the
terminal sits static on the `workingset: timestamp_bits=…` line and the mode
timeline goes fully yellow (S-mode) for ~8s while nothing prints. Speed up
*only* that window; keep the early kernel stream and the post-unpack device
probe + `=== Linux booted ===` + `uname` at 1× so they stay readable.

The boot loop runs on `requestAnimationFrame` and repaints every frame (the
status counter / MHz / timeline update constantly), so even the dead stretch
is genuine streaming frames — `setpts` time-lapses it cleanly. (Contrast with
a truly idle page, where CDP emits nothing and the gap becomes one held
frame.)

`postprocess.ts` keeps everything at 1× except the dead window, which it runs
at 7×. Boundaries (`BOOT_START` 9.5s, `BOOT_END` 17.0s) are timestamps into
`linux.mp4`; boot timing drifts ±1s between runs, so after a re-capture
re-derive them: sample `ffmpeg -i linux.mp4 -vf fps=1` and find where the
`workingset` line becomes — and stops being — the static bottom line. Keep
the window *inside* the dead zone so no readable streaming gets sped up.

## Two input traps

1. **Boot detection**: the BusyBox prompt is `~ #` (not `/ #`). Reliable
   signal is the line `Run /init as init process` — wait for that.
2. **Typing `uname -a`**: there are TWO text inputs on the page —
   the command-palette (`placeholder="Type a command..."`) and the terminal
   (`placeholder="Type command, press Enter..."`). A naive `/command/i` match
   hits the palette (width 0, off-screen) and the keystrokes vanish. Match
   `/press enter/i` to get the terminal input. On Enter its `onkeydown`
   pushes the chars to the UART `rx` queue and the shell runs the command.

## Composition

The boot UI container (button row + timeline canvas + terminal + input) is
~1200×238 — wide and short, so a raw 16:9 crop would letterbox or bury it in
prose. The clip pins that container `position:fixed` at **native scale (1.0)**,
centered on a dark backdrop with a title caption. The container is built
imperatively and mutated in place (it does NOT re-render a new node per frame,
unlike the parametric-svg SVG cells), so pinning the element directly is safe
— no MutationObserver needed.

Do **not** scale it up: at 1200px it already fills the 1280px frame with ~40px
margins. A `transform: scale(1.18)` overflowed the frame and clipped the left
edge of the console (the `[  N.xxxxxx]` kernel-log timestamps). It's
wide-short; there's no headroom to enlarge.

## Framing the linux section (the kiki widget)

The clip opens in the newsletter. Just above the "Embedded Linux?" section is
a **kiki REPL widget** ("kiki is an array programming system… type an
expression"). It's a rendered cell output, not an editor, so `.hotbar` "close"
sweeping does NOT remove it. To open cleanly on the linux section, scroll the
"Embedded Linux?" `<h3>` flush to the top of its `.lm_content` scroll
container (`scroller.scrollTop += heading.top − scroller.top − 16`). The kiki
widget then scrolls off the top. Re-assert the scroll after a ~600ms beat —
the kiki widget lays out late and shifts the heading back down if you only
scroll once.
