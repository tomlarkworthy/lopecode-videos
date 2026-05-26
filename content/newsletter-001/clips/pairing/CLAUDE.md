# pairing clip

Cut at 00:10 in `script.txt`: "Claude Code terminal beside notebook".

A **real pairing session** with a **faked terminal**, in three beats:

1. **Terminal (faked).** The `claude --dangerously-load-development-channels
   server:lopecode` command has been entered; Claude Code is up and
   "Listening for channel messages from: server:lopecode". The terminal's only
   job is to **start the pairing session** — nothing is typed into it here.
2. **Minimize terminal / maximize browser.** The terminal window shrinks away
   to the dock (CSS transform + fade), revealing the real paired notebook.
3. **Type the request in the BROWSER, then Send.** Into the
   `@tomlarkworthy/claude-code-pairing` pane's real `textarea.cc-input`
   ("Message Claude…") chat box — **not** the terminal —
   `disassemble this notebook to my local disk`, then click **Send**. The
   message posts to the live session for real and appears as a sent chat
   bubble (input clears). The host does **not** act on it / run file-sync —
   Send completes the gesture, nothing more.

The earlier mistake this clip fixes: the disassemble request was being typed in
the *terminal*. It belongs in the notebook's pairing chat. The terminal only
launches the pairing.

## What's real vs faked

- **Real:** the notebook is the actual newsletter; the capture page loads with
  `&cc=<token>` to a live Claude Code channel session, so the pairing pane is
  genuinely "● Connected", with the real chat box, watch table, and File Sync
  controls. The request is typed into the real `.cc-input`. Beat 3 frames the
  notebook's "Claude Code Pairing Module" section (prose + commit-velocity
  chart) on the left and the connected pane on the right.
- **Faked:** the Terminal window — a `position:fixed` DOM window (CDP
  screencast captures page content only, never Terminal.app — series CLAUDE.md
  "Faking browser/OS chrome…"), modelled on reference screenshots of the real
  boot. The 5×5 tan pixel-robot is an approximation of the mascot, not exact.

## Recording requires a live token (NOT a one-command re-shoot)

Unlike the other clips, this needs a running Claude Code pairing host:

1. From a host session with the lopecode channel: `get_pairing_token` →
   e.g. `LOPE-60980-SJCZ` (stable per session; middle number = channel port).
2. `LOPE_CC=LOPE-60980-SJCZ bun content/newsletter-001/clips/pairing/clip.ts`

The capture page connects to that live channel for the ~6.5 s of the shot
(channel logs connect → disconnect around the run). The host need do nothing
during capture — the channel server is a separate process, though it WILL
receive the sent chat message ("disassemble this notebook to my local disk")
when beat 3 clicks Send; that's expected and harmless (treat it as demo
content, don't act on it). Without `LOPE_CC` the pane renders "Not connected"
and the clip still produces, but it isn't the real pairing shot.

## Faked terminal — visual spec

From two reference screenshots of the real
`claude --dangerously-load-development-channels server:lopecode` boot:

- **macOS chrome:** traffic lights; centered title `lopecode-dev — ✳ Claude
  Code — bun ‹ claude --dangerously-load-development-channels server:lopecode`;
  a tab strip with the active tab `…erver:lopecode`.
- **Boot body (prompt-ready):** `[tom.larkworthy@Mac lopecode-dev % ` + the
  command in lavender; banner = pixel-robot + `Claude Code v2.1.150` /
  `Opus 4.7 (1M context) · Claude Team` / `~/dev/lopecode-dev`; `Listening for
  channel messages from: server:lopecode` (pink/red); the experimental warning
  (dim); a rounded input box with a lavender `❯` + blinking caret; hint
  `? for shortcuts · ← for agents`.
- The reference also has a *confirm screen* (the "WARNING: Loading development
  channels … 1. I am using this for local development" prompt) — unused here
  (we open at the prompt), but it's the asset for a longer boot cut.

## The rAF-freeze

The newsletter has rAF-driven animation cells that hog the main thread (they
throttle page-side `setTimeout` ~4×, and stutter the reveal + textarea
repaint). After the pairing pane has rendered "Connected", we stub
`window.requestAnimationFrame = () => 0`. The terminal caret blink and the
minimize/dock transition are **CSS** (compositor), so they keep emitting
screencast frames through the holds (a static page emits no frames — series
note "A suspiciously short clip means nothing painted").

## Status

Shot, ~6.5 s (script slot is 5 s; trim in the finishing edit or add a
`pairing-final.mp4`, which `compose.ts` prefers). `pairing` is already in the
`compose.ts` ORDER.
