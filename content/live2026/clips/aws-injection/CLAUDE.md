# aws-injection clip

The essay copies itself to the clipboard as JS, gets pasted into the console of a
public AWS CloudWatch dashboard, re-materialises inside that page, and then reads
the page's own S3 metrics and draws its own chart of them.

Tom's storyboard, verbatim (2026-09-26): *"it should start with the essay itself,
switch to exporter, copy as JS, go to AWS website, open console, inject, so the
essay is recognizable again, open robocoop and draw graph"*.

The injection target is the **public** shared-dashboard page,
`cloudwatch.amazonaws.com/dashboard.html?dashboard=demo&context=<base64>`, not
`console.aws.amazon.com`. Tom: *"no its inside the public CloudWatch shared link,
thats public"*. The `context` blob carries account `267698840337` and a
public-read Cognito identity pool; it is share-link material, published
deliberately. Its CSP is `content-security-policy-report-only`, so nothing blocks
the injected script.

## Raw footage — `raw/` (gitignored, 211 MB)

```
$ ffprobe -show_entries format=duration:stream=width,height,r_frame_rate
live_p1.mov   3456x2234  120/1  942.200000
live_p2.mov   3456x2234  120/1  215.281667
```

Neither file has an audio stream. Two separate recording sessions — p1 is the
injection, p2 is the later robocoop/chart episode, so **a p1→p2 join is a real
session break**, not a continuous take.

### p1 timestamp map

Derived by reading 1 fps contact sheets (`ffmpeg -vf "fps=1,scale=480:-2,tile=6x3"`),
so ±0.5 s except where a frame was checked directly.

```
 0.0– 3.0  essay: "Source-last programming" + abstract, nothing happening
 3.0– 6.9  opens the title cell (p0 = md`# Source-last programming`) in editor-5
 6.9– 8.4  types exporter() — checked at 2 fps: `exp` + autocomplete list open,
           `exporte`, `exporter()`. This is the only shot that links essay→demo.
 8.4– 9.5  fork-notebook panel appears (Copy as JS / Fork / Download)
 9.5–11.0  clicks Copy as JS → "Copied JS snippet to clipboard."
11.0–15.0  toast dwell, nothing happens
15.0–18.0  switches tab to the AWS dashboard
18.0–23.0  dashboard sits idle. Range is 3h, so the widget reads
           "No data available. Try adjusting the dashboard time range."
23.0–26.0  opens devtools, pastes into the console
26.0–29.0  runs it; white flash as the overlay boots
29.0–35.0  essay rendered inside the AWS page
```

Clean windows for the settled "essay inside AWS" shot: **28.5–31.0, 33–35,
37–41**. Browser chrome pops back in at 31–32; a context menu is open at 36 and
again at 41.

### p2 timestamp map

```
160–166   robocoop-5 chat, prompt being composed
166       agent replies with its plan ("Now I'll add the CloudWatch S3 data and
          a Plot visualization directly into robocoop-5…")
166–178   it writes the cells; imports scroll past
178–181   the chart draws
181–190   settled: tooltip `22,341,580 bytes`, and
          cwS3Summary = "**21.31 MB** (22,341,580 bytes) · **58 objects**"
194–215   forks/downloads the result (out of scope for a 30 s teaser)
```

**The best single frame in either take is p2 @183 s.** AWS's own widget on the
left reads 22.34M / 58 across 09/20–09/26 (1w range), and the injected notebook
on the right charts the same bucket — the side-by-side is what proves it is
their data. Full-res reference: `ffmpeg -ss 183 -i raw/live_p2.mov -frames:v 1`.

## Two rejected cuts, 2026-09-26

Both are in git history only through this file; the script that made the second
is `postprocess.ts`.

1. **Hard title cards + static per-beat crops.** Verdict: *"that is absolutely
   incomprehensible. Its not clear that it is one continuous session that the
   audience could replicate."* The diagnosis was the cutting, not the framing:
   cutting between a title card and a new crop each beat destroys the reading
   that this is one session a viewer could reproduce.
2. **Continuous remap** — one take, speed ramps (1× on the actions, 2–8× on the
   dead stretches), Ken Burns per segment, popover cards instead of titles, only
   the opening title slide kept. Verdict: *"no that looks shit I will edit it
   myself."* No further diagnosis was given.

Tom took the edit over at that point and cut **`Source-Last Live 2026.mp4`**
(29.40 s, 3840x2160, no audio stream) — that is the deliverable and the file to
upload. `postprocess.ts` still builds the rejected cut as `aws-injection.mp4`
(27.8 s); it is gitignored, and is kept only as the record of the timings. Treat
the timestamp maps above as this file's durable output, not the cut.

## ffmpeg findings (local ffmpeg 9.0.1)

- **No `drawtext`.** `ffmpeg -filters | grep -c drawtext` → `0`; this build has no
  freetype. Titles and popovers are rendered as PNGs by Playwright (transparent
  via `screenshot({ omitBackground: true })`) and composited with `overlay`.
- **`concat` with `-c copy` produced broken PTS** across these parts: a 27.8 s
  file yielded 7 tiles from `fps=1,tile=6x5`. Re-encoding on the join fixed it
  (818 frames for 27.3 s, verified with `-count_frames`).
- **Input-side `-t` over-ran.** With `-ss S -t RAW -i src`, the encoded parts came
  out longer than asked — measured `part14` at **3.133 s for a 2.0 s request**,
  `part04` 2.867 s for 2.6 s. Every xfade offset is computed from part durations,
  so this silently shifted the whole timeline (planned 27.77 s → actual 30.06 s).
  Fix: seek with `-ss` before `-i`, but put `-t` on the **output** side, after the
  filter chain has already retimed with `setpts`. Belt and braces: probe each part
  with `ffprobe` and build the timeline from measured durations, not planned ones.
- **`zoompan` clamps zoom to ≥ 1**, i.e. it can never show more than `ow` pixels of
  its input. A 3456-wide source therefore cannot be framed full-width by zoompan
  directly. Per segment, pre-scale so the segment's *widest* rect is exactly
  1280 px (`scale=${3456*1280/wmax}:-2`), then `z = wmax/w(t) ≥ 1` holds, and
  `x = rx(t) * p * z`. Keeping each segment's zoom range under ~1.5× keeps the
  upscaling invisible.
- **A headless `chromium.launch()` needs `chromium_headless_shell-1217` shadowed**,
  not just `chromium-1217` as the root `CLAUDE.md` describes — `postprocess.ts`
  renders its PNGs headlessly and dies with `Executable doesn't exist at
  .../chromium_headless_shell-1217/chrome-headless-shell`. Add the second symlink
  alongside the documented one:
  ```bash
  ln -sfn "$C/chromium_headless_shell-1234" /tmp/pwb/chromium_headless_shell-1217
  ```
  The same script runs unshadowed from the `lopecode-dev` superproject, which
  resolves a different Playwright. (This note should graduate to the root
  `CLAUDE.md` Playwright section once its pending edits are committed.)
- **`fade=…:d=.3` is rejected**: `Unable to parse "d" option value ".3" as
  duration`. Write `0.3`.

## Unresolved

- p1's dashboard is on the 3h range, so it reads "No data available" for the
  whole establishing stretch; p2's is on 1w and shows data. Any cut using both
  inherits that inconsistency.
- The teaser has no shot that establishes the dashboard is *public* rather than
  Tom's own console. The URL is in frame at p1 19 s but small.

## Size note

`Source-Last Live 2026.mp4` is **26 MB** for 29.4 s at 3840x2160. The root
`CLAUDE.md` says to consider git-lfs past a few MB per clip; this series passes
that on its first deliverable, and 4K screen footage will keep doing so.
