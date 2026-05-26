# newsletter-001 series

The "Lopecode 001 Quickfire" companion video. One cut per newsletter feature,
in newsletter order. See `script.txt` for the narration + cut list.

## Structure

```
newsletter-001/
  script.txt            cut list + production notes (the plan)
  compose.ts            concatenate the clips into the full video
  newsletter-001.mp4    the assembled rough cut (output of compose.ts)
  clips/
    <name>/             one directory per cut (clip.ts + <name>.mp4 + CLAUDE.md)
```

Each clip is shot and tuned independently (see `clips/<name>/CLAUDE.md`).
`compose.ts` stitches the finished clip mp4s into the full piece.

## Composing the full video

```bash
bun content/newsletter-001/compose.ts
```

Writes `content/newsletter-001/newsletter-001.mp4`.

- The cut order lives in the `ORDER` array in `compose.ts`, copied from
  `script.txt`. Clips not yet shot are simply skipped, so the rough cut grows
  as cuts land — re-run after adding a clip.
- To re-order or drop a cut, edit `ORDER` (e.g. comment out a clip whose
  capture is still parked). The script doesn't read `script.txt` directly;
  keep the two in sync by hand.
- **`-final` override:** if a clip dir contains `<name>-final.mp4` (a cut
  hand-trimmed/tweaked in an editor), compose uses it in preference to the raw
  `<name>.mp4` capture. The run log prints which file each cut resolved to.

## Why re-encode instead of stream-copy

Clips come out at different framerates — screencast clips (`capture()`) land
around 25fps with variable frame timing, stills clips (`captureStills()`) are
constant 30fps. The concat *demuxer* with `-c copy` needs identical stream
params and chokes on the framerate/timebase mismatch.

So `compose.ts` uses the concat *filter*: each input is normalized to
1280×720 @ 30fps, square pixels (letterboxed if aspect differs), then
concatenated and re-encoded H.264 CRF 18. One re-encode of short clips is
cheap and the quality cost at CRF 18 is invisible. The assembled duration
runs a little longer than the sum of the per-clip `ffprobe` durations because
the variable-rate screencast clips re-time to a true constant-rate length.

## What the rough cut is (and isn't)

`newsletter-001.mp4` is a **silent visual rough cut** — the clips back to
back, no transitions, no audio. Per `script.txt`, the finishing pass (VO as
one continuous take, music, burned-in captions, any cross-fades) happens in a
separate edit; the rough cut sets timing and order. Don't add audio or
transitions in `compose.ts` — keep it a deterministic re-assembly so any clip
can be re-shot and the whole thing re-stitched with one command.

## Clip status

Run the per-clip directories for detail. As of writing, shot clips include
intro, parametric-svg (arm + bezier side-by-side), themes, lsp, pdf-tab,
cmd-k, linux. **history** is parked — persistence is hard to show in a 5 s
slot because most of the action is invisible IDB plumbing; see
`clips/history/CLAUDE.md`. Cuts in `script.txt` without a
`clips/<name>/<name>.mp4` (e.g. exporter, pairing, file-sync, drag-out,
atproto, end-card) are not yet shot and are skipped by `compose.ts`.
