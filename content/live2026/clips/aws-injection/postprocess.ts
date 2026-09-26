#!/usr/bin/env bun
// LIVE 2026 teaser — one continuous play-through of the AWS injection, time-remapped.
//
//   bun scratch/live2026-teaser/edit.ts            # full build
//   bun scratch/live2026-teaser/edit.ts --sheet    # + contact sheet of the result
//
// The take is never cut away from: segments are contiguous in the source, and only the
// playback rate and the framing change. Framing is a Ken Burns move per segment (rect in
// source pixels, interpolated frame by frame). Commentary is a popover card faded over the
// footage, not a title card — the only hard title is the opening slide.
//
// Raw footage is never modified; CUTS + POPS below are the source of truth.

import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const HERE = import.meta.dir;
const RAW = join(HERE, "raw");
const OUT = join(HERE, "build");
const P1 = join(RAW, "live_p1.mov");
const P2 = join(RAW, "live_p2.mov");

const W = 1280, H = 720, FPS = 30, SRCW = 3456;

// [x, y, w, h] in source pixels (3456×2234). 16:9 so nothing letterboxes.
type Rect = [number, number, number, number];
type Title = { kind: "title"; text: string; dur: number; fade: number };
type Clip = {
  kind: "clip"; src: string; start: number; end: number; speed: number;
  from: Rect; to?: Rect; fade: number; note: string;
};
type Cut = Title | Clip;

// fade = length of the dissolve joining this cut to the previous one. 0.08 reads as a
// straight join (the source is continuous across it); longer only where the take jumps.
const CUTS: Cut[] = [
  { kind: "title", text: "An essay that carries its own runtime", dur: 1.6, fade: 0 },

  // --- p1: the essay, live -------------------------------------------------
  { kind: "clip", src: P1, start: 0.8, end: 3.3, speed: 1.0, fade: 0.45,
    from: [0, 0, 2600, 1463], to: [0, 0, 2300, 1294], note: "the essay, running" },
  { kind: "clip", src: P1, start: 3.3, end: 6.9, speed: 2.4, fade: 0.08,
    from: [0, 0, 2300, 1294], to: [0, 0, 1900, 1069], note: "opens the title cell" },
  { kind: "clip", src: P1, start: 6.9, end: 9.6, speed: 1.0, fade: 0.08,
    from: [0, 0, 1900, 1069], to: [0, 40, 1760, 990], note: "types exporter()" },
  { kind: "clip", src: P1, start: 9.6, end: 12.2, speed: 1.0, fade: 0.08,
    from: [0, 40, 1760, 990], to: [0, 80, 1660, 934], note: "Copy as JS → clipboard toast" },
  { kind: "clip", src: P1, start: 12.2, end: 15.6, speed: 3.4, fade: 0.08,
    from: [0, 80, 1660, 934], to: [0, 0, 3456, 1944], note: "pull back, leaves the notebook" },

  // --- p1: someone else's site --------------------------------------------
  { kind: "clip", src: P1, start: 15.6, end: 18.6, speed: 2.0, fade: 0.08,
    from: [0, 0, 3456, 1944], to: [0, 0, 2900, 1631], note: "switches to the AWS tab" },
  { kind: "clip", src: P1, start: 18.6, end: 23.2, speed: 4.0, fade: 0.08,
    from: [0, 0, 2900, 1631], to: [600, 0, 2856, 1607], note: "opens devtools" },
  { kind: "clip", src: P1, start: 23.2, end: 27.6, speed: 1.6, fade: 0.08,
    from: [600, 0, 2856, 1607], to: [1950, 120, 1506, 847], note: "pastes into their console" },
  { kind: "clip", src: P1, start: 27.6, end: 30.6, speed: 1.0, fade: 0.08,
    from: [1950, 120, 1506, 847], to: [0, 0, 2320, 1305], note: "the essay materialises" },
  { kind: "clip", src: P1, start: 30.6, end: 33.6, speed: 1.6, fade: 0.08,
    from: [0, 0, 2320, 1305], to: [0, 100, 2600, 1463], note: "settled inside AWS" },

  // --- p2: it reads their data --------------------------------------------
  { kind: "clip", src: P2, start: 166.0, end: 170.0, speed: 4.0, fade: 0.5,
    from: [1500, 0, 1956, 1100], to: [1500, 200, 1956, 1100], note: "asks for a chart" },
  { kind: "clip", src: P2, start: 170.0, end: 178.0, speed: 8.0, fade: 0.08,
    from: [1500, 200, 1956, 1100], to: [1500, 760, 1956, 1100], note: "it writes the cells" },
  { kind: "clip", src: P2, start: 178.0, end: 181.5, speed: 1.0, fade: 0.08,
    from: [1500, 900, 1956, 1100], to: [1450, 1000, 2006, 1128], note: "the chart draws" },
  { kind: "clip", src: P2, start: 181.5, end: 183.5, speed: 1.0, fade: 0.08,
    from: [1400, 1000, 2056, 1157], to: [0, 120, 3456, 1944], note: "pull back: their widget + our chart" },
];

type Pos = "bottom-left" | "bottom-right" | "top-left" | "top-right";
// at = seconds into that segment; a popover may outlive its segment, the time is absolute.
type Pop = { seg: number; at: number; dur: number; text: string; pos: Pos };

const POPS: Pop[] = [
  { seg: 3, at: 0.3, dur: 2.4, text: "exporter() — the notebook serialises itself", pos: "bottom-left" },
  { seg: 4, at: 0.7, dur: 2.0, text: "Copy as JS — the whole program, on the clipboard", pos: "bottom-left" },
  { seg: 6, at: 0.2, dur: 2.4, text: "A public AWS dashboard. Someone else's page.", pos: "bottom-left" },
  { seg: 8, at: 0.9, dur: 2.0, text: "Paste it into their console", pos: "bottom-left" },
  { seg: 9, at: 1.3, dur: 2.4, text: "The essay is now running inside their page", pos: "bottom-right" },
  { seg: 11, at: 0.1, dur: 2.2, text: "Ask the agent to chart their data", pos: "bottom-left" },
  { seg: 13, at: 1.4, dur: 2.2, text: "Their bucket, charted by the essay", pos: "bottom-left" },
];

const run = (args: string[]) => {
  const r = spawnSync(args[0], args.slice(1), { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${args[0]} failed: ${r.stderr?.slice(-800)}`);
  return r.stdout;
};

const probeDur = (f: string) => Number(run(["ffprobe", "-v", "error",
  "-show_entries", "format=duration", "-of", "csv=p=0", f]).trim());

const ENC = ["-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-an"];

// Ken Burns via zoompan: zoom is clamped to >= 1, so pre-scale the source such that the
// widest rect of this segment is exactly the output width. Then z = Wmax/W(t) >= 1.
function kenBurns(from: Rect, to: Rect, frames: number) {
  const wmax = Math.max(from[2], to[2]);
  const p = W / wmax;                       // source px -> prescaled px
  const sw = Math.round((SRCW * p) / 2) * 2;
  const n = Math.max(frames - 1, 1);
  const lerp = (a: number, b: number) => (a === b ? `${a}` : `(${a}+(${b - a})*on/${n})`);
  const z = `(${wmax}/${lerp(from[2], to[2])})`;
  const x = `(${lerp(from[0], to[0])}*${p.toFixed(6)}*${z})`;
  const y = `(${lerp(from[1], to[1])}*${p.toFixed(6)}*${z})`;
  return `scale=${sw}:-2,zoompan=z='${z}':x='${x}':y='${y}':d=1:s=${W}x${H}:fps=${FPS}`;
}

async function renderPng(html: string, file: string, transparent: boolean) {
  const { chromium } = await import("playwright");
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  await p.setContent(html);
  await p.screenshot({ path: file, omitBackground: transparent });
  await b.close();
}

const FONT = `-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif`;

const titleHtml = (text: string) => `<style>
  html,body{margin:0;height:100%;background:#0b1020;display:grid;place-items:center}
  p{margin:0;max-width:62%;text-align:center;color:#e8ecf5;
    font:600 46px/1.25 ${FONT};letter-spacing:-.01em}
</style><p>${text}</p>`;

const popHtml = (text: string, pos: Pos) => {
  const [v, h] = pos.split("-");
  return `<style>
  html,body{margin:0;height:100%;background:transparent}
  body{display:flex;padding:44px;box-sizing:border-box;
    align-items:${v === "top" ? "flex-start" : "flex-end"};
    justify-content:${h === "left" ? "flex-start" : "flex-end"}}
  div{max-width:760px;padding:15px 22px;border-radius:14px;color:#eef2fb;
    background:rgba(9,13,26,.90);border:1px solid rgba(232,236,245,.18);
    box-shadow:0 10px 34px rgba(0,0,0,.45);font:500 29px/1.3 ${FONT};letter-spacing:-.005em}
</style><div>${text}</div>`;
};

mkdirSync(OUT, { recursive: true });
for (const f of [P1, P2]) if (!existsSync(f)) throw new Error("missing footage: " + f);

// --- render the parts ------------------------------------------------------
const parts: string[] = [];
const durs: number[] = [];
for (let i = 0; i < CUTS.length; i++) {
  const c = CUTS[i];
  const out = join(OUT, `part${String(i).padStart(2, "0")}.mp4`);
  if (c.kind === "title") {
    const png = join(OUT, `title${i}.png`);
    await renderPng(titleHtml(c.text), png, false);
    run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-t", String(c.dur), "-i", png,
      "-vf", `fps=${FPS},format=yuv420p`, ...ENC, out]);
    durs.push(probeDur(out));
    console.log(`${String(i).padStart(2)}  title  ${c.dur.toFixed(2)}s  "${c.text}"`);
  } else {
    const raw = c.end - c.start;
    const dur = raw / c.speed;
    const frames = Math.max(Math.round(dur * FPS), 2);
    const vf = [
      c.speed === 1 ? null : `setpts=PTS/${c.speed}`,
      `fps=${FPS}`,
      kenBurns(c.from, c.to ?? c.from, frames),
    ].filter(Boolean).join(",");
    // -t on the OUTPUT side: input-side trimming over-ran by up to a second on this footage
    run(["ffmpeg", "-v", "error", "-y", "-ss", String(c.start), "-i", c.src,
      "-vf", vf, "-t", dur.toFixed(3), ...ENC, out]);
    durs.push(probeDur(out));
    console.log(`${String(i).padStart(2)}  clip   ${dur.toFixed(2)}s  ${c.speed}x  ${c.note}`);
  }
  parts.push(out);
}

// --- timeline --------------------------------------------------------------
const starts: number[] = [0];
for (let i = 1; i < CUTS.length; i++) starts[i] = starts[i - 1] + durs[i - 1] - CUTS[i].fade;
const total = starts[CUTS.length - 1] + durs[CUTS.length - 1];

// --- popovers --------------------------------------------------------------
const popFiles: string[] = [];
const popTimes: Array<[number, number]> = [];
for (let k = 0; k < POPS.length; k++) {
  const p = POPS[k];
  const png = join(OUT, `pop${k}.png`);
  await renderPng(popHtml(p.text, p.pos), png, true);
  popFiles.push(png);
  const t0 = starts[p.seg] + p.at;
  popTimes.push([t0, t0 + p.dur]);
  console.log(`pop${k}  ${t0.toFixed(2)}–${(t0 + p.dur).toFixed(2)}s  "${p.text}"`);
}

// --- join + overlay in one encode -----------------------------------------
const args = ["ffmpeg", "-v", "error", "-y"];
for (const f of parts) args.push("-i", f);
for (const f of popFiles) args.push("-loop", "1", "-framerate", String(FPS), "-i", f);

const fc: string[] = [];
let cur = "[0:v]";
for (let i = 1; i < parts.length; i++) {
  const lbl = `[x${i}]`;
  fc.push(`${cur}[${i}:v]xfade=transition=fade:duration=${CUTS[i].fade}:offset=${starts[i].toFixed(4)}${lbl}`);
  cur = lbl;
}
for (let k = 0; k < popFiles.length; k++) {
  const [t0, t1] = popTimes[k];
  const idx = parts.length + k;
  fc.push(`[${idx}:v]format=rgba,fade=t=in:st=${t0.toFixed(3)}:d=0.3:alpha=1,` +
    `fade=t=out:st=${(t1 - 0.3).toFixed(3)}:d=0.3:alpha=1[pp${k}]`);
  fc.push(`${cur}[pp${k}]overlay=0:0:enable='between(t,${t0.toFixed(3)},${t1.toFixed(3)})':eof_action=pass[ov${k}]`);
  cur = `[ov${k}]`;
}
fc.push(`${cur}format=yuv420p[out]`);

const final = join(HERE, "aws-injection.mp4");
args.push("-filter_complex", fc.join(";"), "-map", "[out]", ...ENC, "-shortest",
  "-movflags", "+faststart", final);
run(args);

const dur = Number(run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
  "-of", "csv=p=0", final]).trim());
console.log(`\n${final}\n${dur.toFixed(2)}s (budget 30s) — planned ${total.toFixed(2)}s`);
if (dur > 30) console.log("OVER BUDGET: raise a speed or trim a segment");

if (process.argv.includes("--sheet")) {
  const sheet = join(OUT, "sheet.png");
  run(["ffmpeg", "-v", "error", "-y", "-i", final, "-vf", "fps=1,scale=320:-2,tile=6x5",
    "-frames:v", "1", sheet]);
  console.log("sheet:", sheet);
}
