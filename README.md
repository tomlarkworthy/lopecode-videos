# lopecode-videos

Video content for lopecode, including Playwright-automated clip capture.

## Layout

```
content/
  newsletter-001/
    script.txt        # narration / cut list
    clips/            # rendered clips (one subdir per cut)
      <cut-name>/     # .webm captures + per-clip metadata
src/
  capture.ts          # shared Playwright harness
  clips/
    <cut-name>.ts     # one script per clip
```

## Running a clip

```bash
bun src/clips/<cut-name>.ts
```

Output lands in `content/<series>/clips/<cut-name>/`.
