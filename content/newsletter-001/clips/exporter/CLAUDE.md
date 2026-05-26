# exporter clip

exporter-3: a notebook serializes itself — runtime + every dependency — into
one self-contained `.html`. Two panes:

- **Left**: the newsletter's **"Exporter-3 Upgrades"** section (`h3`, the prose
  that names the feature).
- **Right**: the **full exporter-3 module** opened as its own pane — title,
  the live Download UI (Copy as JS / Fork / **Download**), and the detailed
  feature list (File-first, Recursive/self-sustaining, Moldable,
  Runtime-as-source-of-truth, No sandboxing, Userspace…). This is the "lots of
  detail" the section refers to, shown live beside it.

URL: `R100(@…/lopecode-newsletter-001,S50(@…/exporter-3))`.

Beat: hit **Download** → the single file drops out.

## Why open the module as a pane (not mount its UI)

An earlier cut mounted the exporter UI by digging the `exporter` function out
of the runtime (`__ojs_runtime._variables`) and appending its node. Don't —
opening `@tomlarkworthy/exporter-3` as a **pane** renders the same live UI
natively, plus all its documentation, with zero runtime-internals poking. If a
feature has a home module with an interactive widget, film it there.

## The manifest table is the payoff, and it's free

Clicking the real **Download** makes the exporter expand an **export manifest**
— every bundled module/asset with byte sizes (bootloader, codemirror,
prosemirror, parametric-svg, the sample PDF, isomorphic-git…). That table *is*
the "many modules → one file" message; it appeared without being asked for.
Lesson: click the real control in QA first and watch what it does on screen —
the genuine behaviour may be a better shot than whatever you were going to fake.

## Faking the download shelf

The browser download shelf is Chrome chrome — CDP screencast never sees it. So:
- `page.on('download', (d) => d.path().catch(()=>{}))` swallows the real
  download (saved to a temp dir, ignored) so the click doesn't hang the page.
- A styled `position:fixed` pill bottom-left (file icon + filename + `1.9 MB ·
  Done`) sliding up via a `transform:translateY` transition recreates the shelf
  convincingly. Filename = the notebook being viewed
  (`@tomlarkworthy_lopecode-newsletter-001.html`).

## Dropped: edit-and-reopen

An earlier version edited the title `#1`→`#2`, faked the download, double-
clicked the pill, white-flashed, and revealed the modified title ("your edit is
baked in"). It worked (see git history) but was 8.6s and busy. The director's
call was: the module's own detail beside the section, plus the download, is
enough. The edit/reopen mechanics (title edit via editor, flash transition) are
still useful patterns if a future clip wants them.

## Pacing (~4.7s)

- 500 ms on the framed two-pane start.
- glide to Download (22 steps), 300 ms, click.
- 450 ms, then the pill slides up.
- 1500 ms hold on docs + UI + the one file.

Compressible: the end hold. Could add a short scroll down the exporter-3
feature list before Download if more "detail" is wanted on screen.
