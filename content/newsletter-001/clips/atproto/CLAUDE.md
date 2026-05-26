# atproto

Publishes the newsletter-001 lopebook bundle to the user's ATProto PDS via
the `@tomlarkworthy/at-write` `publishWidget`.

Layout: newsletter pane left (scrolled to **ATProto publishing** section),
at-write widget right. The viewer sees the source tile clicked, the title
typed, the diff resolve, and the success card render with the
`did:plc:.../com.lopecode.bundle/newsletter-001` link.

## Re-recording

```bash
bun content/newsletter-001/clips/atproto/clip.ts
```

Produces `atproto.mp4` (~12 s on a cache-warm publish, ~60 s on a cold
first publish). See **Cache-warm vs cold** below.

## Auth

The clip uses Playwright's persistent `userDataDir` so the at-login session
survives across recordings. The profile lives in `.auth/chrome-profile`
**inside the repo** (gitignored) — not under `~/`, because the safehouse
sandbox blocks home-dir writes.

When the session expires (or for first-time setup), re-run the auth helper:

```bash
bun content/newsletter-001/clips/atproto/auth.ts
```

It launches a headed window pointed at the same view; sign in manually to
Bluesky/ATProto via the at-login widget, then close the browser. The clip
will reuse the saved session on the next run.

## Stable rkey

rkey is auto-derived from the title via `utils.slugifyTitle` (NFKD strip,
non-alphanumeric → `-`, lowercase, 64-char cap). The clip types
`"Newsletter 001"` → rkey `"newsletter-001"`. Each republish overwrites
the same record, so no feed clutter from re-records.

Type a **human-readable** title, not the rkey form. The widget shows both
fields side-by-side specifically so the title→rkey transformation is
visible — typing the already-slugged form makes them identical and hides
the whole point of the row.

## Cache-warm vs cold

`@tomlarkworthy/at-write` keeps a per-DID **CID cache** in `localStorage`,
updated **only after `putRecord` succeeds**. Consequences:

- **First publish ever (cold):** ~86 blobs / ~2.9 MB to upload. Takes
  30–60 s. The CDP screencast captures the live `uploading N/86` progress
  during this stretch, so the raw mp4 is correspondingly long.
- **Subsequent publishes (warm):** `86 already pinned`, ~373 B to upload,
  done in ~5 s. The whole clip is ~12 s end-to-end.

If a cold publish gets aborted (e.g. clip's poll timeout hit too early), the
cache is **not** written and the next run re-uploads everything. The clip's
poll window is now 90 s (360 × 250 ms) to cover a cold first run with
margin.

## Why direct `.click()` instead of `mouse.click(x, y)`

The source tiles register `addEventListener('click', …)` on the
`[data-source="…"]` element itself. Click bubbling from child spans/icons
works, but to remove all ambiguity (coordinate rounding, child overlay) the
clip fires a synthetic `element.click()` while still gliding the visible
cursor with `mouse.move` for the camera. Same trick for the Publish button.

## Stage progression

The widget cycles `state.stage` through `pick → computing → diff →
publishing → done`. Selectors that distinguish stages:

| Stage         | Selector signal                                   |
| ------------- | ------------------------------------------------- |
| pick          | `[data-source="…"]` tiles present, no title input |
| computing     | tiles still present, file table not yet rendered  |
| diff          | `input[data-field="title"]` mounted               |
| publishing    | `[data-btn="publish"]` disabled, footer "writing record…" |
| done          | `[data-btn="another"]` mounted (success card)     |

The clip waits on each: `waitForSelector('input[data-field="title"]')`
after the source pick, `waitForFunction(!btn.disabled)` after the title is
typed, and polls for `[data-btn="another"]` after Publish.

## Pane reflow after success

`renderDone()` replaces the form body with a much smaller success card,
which shrinks the widget vertically. The lopepage pane's scroll position
stays the same, so the smaller widget ends up scrolled out of frame and
the cells *below it* in the at-write module (About, How it works) fill the
view. The clip detects success and **re-pins the widget root to the top of
the pane** (walk up to the `.observablehq` mount wrap, scroll the
`.lm_content` ancestor) before holding the final frame.

## What's NOT framed

The widget header reads `Publish a lopebook · step 3/3` and the success
card shows a copyable `at://…/com.lopecode.bundle/newsletter-001` URI plus
a `lopecode.com/r/{rkey}` web link. The actual PDS write (`uploadBlob` ×N
then `putRecord`) happens in the background; the viewer sees the diff
table change (`N new uploads → 0 to upload` once cached) and the Published
state.

## Chrome autofill bleaches the title input

The persistent profile (`.auth/chrome-profile`) caches every value ever
typed into the title input. Chrome then renders the **typed** text via
`-webkit-text-fill-color`, which silently overrides the widget's own
`color:#1a1814` — the input ends up near-white-on-cream in the recording
and reads as empty. `autocomplete="off"` does **not** disable this.

The clip works around it by setting inline `!important` styles on the
input before typing:

```ts
input.style.setProperty('color', '#1a1814', 'important');
input.style.setProperty('background', '#ffffff', 'important');
input.style.setProperty('-webkit-text-fill-color', '#1a1814', 'important');
```

Don't switch to `input.value = '…'` + synthetic input-event as a
"fix" — the screencast emits frames only on paint, and a one-shot value
assignment + no keystroke animation collapses the clip to ~2 s (see
*A suspiciously short clip means nothing painted* in the root CLAUDE.md).

## Notes for the cut

- 12 s is on the long side for the quickfire series. Post-trim the
  middle (diff settling + typing) if compressing further.
- The hold is 2.5 s after the success card lands — CDP screencast lags
  state by ~250 ms and a shorter hold can cut to mid-render.
