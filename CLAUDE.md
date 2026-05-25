# lopecode-videos

Video content for lopecode, captured by Playwright-driven browser automation.

## Layout

```
src/                                  framework only — no clip specifics
  capture.ts                          shared Playwright harness
content/
  <series>/
    script.txt                        narration + cut list for the series
    clips/
      <cut-name>/                     one directory per cut
        clip.ts                       Playwright choreography
        <cut-name>.webm               captured output (committed)
```

`src/` is for things that are useful across every clip: the launch/record
plumbing, helpers like `pause` and `glide`, future cursor overlay, future
concat tooling. Anything that references a specific notebook URL, selector,
or timing belongs in the clip directory, not here.

`content/` is for clip artifacts. Choreography (`clip.ts`) and captured
video (`*.webm`) live side-by-side so a clip is self-contained — you can
re-record a single cut by editing one file and running one command.

## Adding a clip

```bash
mkdir -p content/<series>/clips/<name>
$EDITOR content/<series>/clips/<name>/clip.ts
bun content/<series>/clips/<name>/clip.ts
```

Skeleton:

```ts
import { capture, pause } from '../../../../src/capture.ts';

const URL = 'file:///…/notebook.html#view=…';

await capture(
  { url: URL, outDir: import.meta.dir, videoName: '<name>' },
  async (page) => {
    // choreography
  },
);
```

`outDir: import.meta.dir` keeps the video next to the script that produced
it. `videoName` becomes the stable filename; Playwright's random per-run
filename gets renamed on close.

## Conventions

- Fixed viewport 1280×720 across a series so cuts composite identically.
- Insert ~400ms beats between actions for visual breathing room.
- `page.mouse.move(x, y, { steps: 30 })` so cursor motion glides rather
  than teleports.
- Captures are silent; VO + music get composited in post.
- `*.webm` files are committed. If sizes grow past a few MB per clip,
  migrate to git-lfs (not yet needed).

## Why per-clip directories instead of `src/clips/`

A clip is choreography + output. Co-locating them means:

- The series content tree is the source of truth for what was made.
- Adding a series adds directories; the framework doesn't change.
- A re-record is one file edit and one command, with no cross-tree hunt.
