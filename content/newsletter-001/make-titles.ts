// Generate a title card per feature clip: a short slide naming the feature and
// its module (e.g. "Reactive Theming" / @tomlarkworthy/themes). compose.ts
// interleaves these before their clips.
//
// Titles mirror the newsletter section headings and the module each section's
// `aside('…')` names, so the cards correlate with the newsletter. Cards are
// rendered as HTML via Playwright (this ffmpeg build has no drawtext/freetype)
// at retina, screenshotted, then encoded to a short mp4 with a soft fade.
//
// Edit TITLES to change wording or modules, then re-run:
//   bun content/newsletter-001/make-titles.ts
import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const SERIES_DIR = import.meta.dir;
const OUT_DIR = join(SERIES_DIR, '.titles');

// clip name → { feature title, module short-name }. Order/selection lives in
// compose.ts; this is just the card content. Add an entry to give a clip a card.
const TITLES: Record<string, { title: string; module: string }> = {
  'cmd-k': { title: 'CMD + K Command Bar', module: 'command-palette' },
  'parametric-svg': { title: 'Parametric SVG Editor', module: 'parametric-svg' },
  exporter: { title: 'Exporter-3 Upgrades', module: 'exporter-3' },
  pairing: { title: 'Claude Code Pairing', module: 'claude-code-pairing' },
  themes: { title: 'Reactive Theming', module: 'themes' },
  lsp: { title: 'LSP Integration', module: 'editor-5' },
  'pdf-tab': { title: 'Native Browser Tabs', module: 'lopepage' },
  atproto: { title: 'ATProto Publishing', module: 'at-write' },
  linux: { title: 'Embedded Linux', module: 'linux-sbc' },
};

const W = 1280;
const H = 720;
const DUR = 1.0; // seconds on screen
const FADE = 0.15; // fade in/out seconds

const cardHtml = (title: string, mod: string) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${W}px;height:${H}px;background:#06080d;overflow:hidden;}
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;
    background:radial-gradient(60% 50% at 50% 45%, #0d1322 0%, #06080d 70%);}
  .kicker{font:600 15px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.42em;text-transform:uppercase;color:#5b6b80;padding-left:0.42em;}
  .title{font:700 66px/1.1 ui-sans-serif,system-ui,sans-serif;color:#e6edf3;letter-spacing:-0.01em;text-align:center;max-width:1040px;}
  .rule{width:64px;height:3px;background:#58a6ff;border-radius:2px;opacity:0.9;}
  .module{font:500 30px/1 ui-monospace,"SF Mono",Menlo,monospace;color:#58a6ff;}
  .module .ns{color:#6e7d90;}
  .cursor{display:inline-block;width:0.55em;height:1.05em;background:#58a6ff;transform:translateY(0.18em);margin-left:0.15em;opacity:0.85;}
</style></head><body><div class="wrap">
  <div class="kicker">Feature</div>
  <div class="title">${title}</div>
  <div class="rule"></div>
  <div class="module"><span class="ns">@tomlarkworthy/</span>${mod}<span class="cursor"></span></div>
</div></body></html>`;

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await context.newPage();

for (const [clip, { title, module }] of Object.entries(TITLES)) {
  await page.setContent(cardHtml(title, module), { waitUntil: 'load' });
  await page.waitForTimeout(120);
  const png = join(OUT_DIR, `${clip}.png`);
  await page.screenshot({ path: png });

  const mp4 = join(OUT_DIR, `${clip}.mp4`);
  const fadeOut = (DUR - FADE).toFixed(3);
  const res = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-loop', '1',
      '-t', String(DUR),
      '-i', png,
      '-r', '30',
      '-vf', `scale=${W}:${H},fade=t=in:st=0:d=${FADE},fade=t=out:st=${fadeOut}:d=${FADE},format=yuv420p`,
      '-c:v', 'libx264',
      '-crf', '18',
      '-preset', 'slow',
      '-movflags', '+faststart',
      mp4,
    ],
    { stdio: 'pipe' },
  );
  if (res.status !== 0) {
    console.error('ffmpeg failed for', clip, '\n', res.stderr.toString());
    process.exit(1);
  }
  console.log('card →', clip, `(${title} / @tomlarkworthy/${module})`);
}

await context.close();
await browser.close();
console.log('\nTitle cards written to', OUT_DIR);
