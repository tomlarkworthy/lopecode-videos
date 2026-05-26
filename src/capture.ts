import { chromium, type Page } from 'playwright';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export interface CaptureOptions {
  outDir: string;
  url: string;
  videoName?: string;
  viewport?: { width: number; height: number };
  warmupMs?: number;
  /** JPEG quality of each screencast frame, 1-100. Default 90. */
  quality?: number;
  /** devicePixelRatio for the browser context. Default 2 (retina). */
  deviceScaleFactor?: number;
  /** Target output framerate. Default 30. */
  framerate?: number;
  /** Keep raw frames after encoding for debugging. Default false. */
  keepFrames?: boolean;
  /**
   * Crop region in viewport CSS pixels (NOT device pixels). Output is then
   * scaled to match the viewport size, so a w/h that's half the viewport
   * produces a 2× zoom. Aspect ratio of the crop should match the viewport
   * to avoid letterboxing.
   */
  crop?: { x: number; y: number; w: number; h: number };
  /**
   * Path to a Chromium user-data-dir. When set, Playwright reuses cookies,
   * localStorage, IndexedDB etc. across runs — required for clips that need
   * a real authenticated session (e.g. atproto OAuth). The dir is created
   * if absent. Set up the initial login via a one-time helper script
   * (see content/newsletter-001/clips/atproto/auth.ts).
   */
  userDataDir?: string;
}

export interface CaptureControls {
  /**
   * Begin recording. Call this once the page is in the state you want the
   * clip to start from — earlier setup work (page load, scrolling, layout
   * settling) won't appear in the final video.
   */
  mark: () => Promise<void>;
}

export interface CaptureResult {
  videoPath: string;
}

/**
 * Capture a clip by driving a Chromium page via Playwright and grabbing
 * frames through Chrome DevTools Protocol's `Page.startScreencast`.
 *
 * Compared to Playwright's built-in `recordVideo` (VP8 webm, low bitrate,
 * always-on), this:
 *   - encodes via ffmpeg to H.264 mp4 at CRF 18 — much sharper on text
 *   - lets the choreography control when recording begins via `mark()`
 *   - renders at deviceScaleFactor 2 by default so retina edges stay crisp
 */
export async function capture(
  opts: CaptureOptions,
  choreograph: (page: Page, ctrl: CaptureControls) => Promise<void>,
): Promise<CaptureResult> {
  const viewport = opts.viewport ?? { width: 1280, height: 720 };
  const quality = opts.quality ?? 90;
  const dpr = opts.deviceScaleFactor ?? 2;
  const stableName = (opts.videoName ?? 'clip') + '.mp4';

  await mkdir(opts.outDir, { recursive: true });
  const framesDir = join(opts.outDir, '.frames');
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  // Persistent context (with cookies/localStorage from prior sessions) when
  // a userDataDir is supplied; otherwise a fresh ephemeral context.
  let browser: import('playwright').Browser | null = null;
  let context: import('playwright').BrowserContext;
  if (opts.userDataDir) {
    await mkdir(opts.userDataDir, { recursive: true });
    context = await chromium.launchPersistentContext(opts.userDataDir, {
      headless: false,
      viewport,
      deviceScaleFactor: dpr,
    });
  } else {
    browser = await chromium.launch({ headless: false });
    context = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  }
  const page = context.pages()[0] ?? (await context.newPage());
  const cdp = await context.newCDPSession(page);

  let recording = false;
  let frameIndex = 0;
  const frameTimes: number[] = [];
  let firstTs: number | null = null;
  const pendingWrites: Promise<void>[] = [];

  cdp.on('Page.screencastFrame', (params: { data: string; sessionId: number; metadata?: { timestamp?: number } }) => {
    if (recording) {
      if (process.env.CAPTURE_DEBUG) console.error('[frame]', frameIndex, params.metadata?.timestamp);
      const idx = frameIndex++;
      const name = String(idx).padStart(6, '0') + '.jpg';
      pendingWrites.push(writeFile(join(framesDir, name), Buffer.from(params.data, 'base64')));
      // CDP timestamp is seconds (epoch). Fall back to wall clock if missing.
      const tsMs = params.metadata?.timestamp != null ? params.metadata.timestamp * 1000 : Date.now();
      if (firstTs == null) firstTs = tsMs;
      frameTimes.push(tsMs - firstTs);
    }
    cdp.send('Page.screencastFrameAck', { sessionId: params.sessionId }).catch(() => {});
  });

  await page.goto(opts.url, { waitUntil: 'load' });
  await page.waitForTimeout(opts.warmupMs ?? 1500);

  const screencastParams = { format: 'jpeg' as const, quality, everyNthFrame: 1 };

  let marked = false;
  const ctrl: CaptureControls = {
    mark: async () => {
      if (marked) return;
      marked = true;
      recording = true;
      await cdp.send('Page.startScreencast', screencastParams);
    },
  };

  // A page navigation tears down the screencast — CDP stops emitting frames
  // for the new document. Re-arm it after each main-frame navigation so a
  // choreography that clicks a link (and lands on another notebook) keeps
  // recording seamlessly. Frame timestamps are monotonic across the gap, so
  // the encoded video just shows the load as a continuous beat.
  page.on('framenavigated', async (frame) => {
    if (frame !== page.mainFrame() || !recording) return;
    if (process.env.CAPTURE_DEBUG) console.error('[framenavigated] re-arming screencast');
    try {
      await cdp.send('Page.startScreencast', screencastParams);
      if (process.env.CAPTURE_DEBUG) console.error('[framenavigated] re-armed ok');
    } catch (e) {
      if (process.env.CAPTURE_DEBUG) console.error('[framenavigated] re-arm failed', e);
    }
  });

  try {
    await choreograph(page, ctrl);
  } finally {
    recording = false;
    try {
      await cdp.send('Page.stopScreencast');
    } catch {}
    await Promise.allSettled(pendingWrites);
    await context.close();
    await browser?.close();
  }

  if (!marked) {
    throw new Error('choreograph never called ctrl.mark(); nothing recorded');
  }
  if (frameIndex === 0) {
    throw new Error('No frames captured after mark()');
  }

  // Build an ffmpeg concat list with per-frame durations driven by the screencast timestamps.
  const concatLines: string[] = [];
  for (let i = 0; i < frameIndex; i++) {
    const name = String(i).padStart(6, '0') + '.jpg';
    concatLines.push(`file '${join(framesDir, name)}'`);
    if (i < frameIndex - 1) {
      const durSec = Math.max(0.001, (frameTimes[i + 1] - frameTimes[i]) / 1000);
      concatLines.push(`duration ${durSec.toFixed(4)}`);
    }
  }
  // concat demuxer needs the last file repeated so the final frame's duration is honoured.
  concatLines.push(`file '${join(framesDir, String(frameIndex - 1).padStart(6, '0') + '.jpg')}'`);
  const listFile = join(framesDir, 'concat.txt');
  await writeFile(listFile, concatLines.join('\n'));

  const outFile = join(opts.outDir, stableName);
  await rm(outFile, { force: true });

  // Frames are captured at viewport × dpr; convert any crop to device pixels.
  const filters: string[] = [];
  if (opts.crop) {
    const c = opts.crop;
    filters.push(`crop=${c.w * dpr}:${c.h * dpr}:${c.x * dpr}:${c.y * dpr}`);
  }
  filters.push(`scale=${viewport.width}:${viewport.height}:flags=lanczos`);

  const ffmpegArgs = [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listFile,
    '-vsync', 'vfr',
    '-c:v', 'libx264',
    '-crf', '18',
    '-preset', 'slow',
    '-pix_fmt', 'yuv420p',
    '-vf', filters.join(','),
    '-movflags', '+faststart',
    outFile,
  ];
  const result = spawnSync('ffmpeg', ffmpegArgs, { stdio: 'pipe' });
  if (result.status !== 0) {
    throw new Error('ffmpeg failed:\n' + result.stderr.toString());
  }

  if (!opts.keepFrames) {
    await rm(framesDir, { recursive: true, force: true });
  }

  return { videoPath: outFile };
}

export async function pause(page: Page, ms = 400) {
  await page.waitForTimeout(ms);
}

export async function glide(page: Page, x: number, y: number, steps = 30) {
  await page.mouse.move(x, y, { steps });
}

// ---------------------------------------------------------------------------
// Stills mode
//
// For clips where we want the result to look like a sequence of clean stills
// (no animations, no transitions, no network lag visible) — e.g. cycling
// theme palettes where the CSS bundle fetch produces a smear. The choreography
// drives the page through each state, waits for it to settle, and calls
// `ctrl.takeStill()`. After the choreography ends, we encode the PNGs into a
// video where every still is shown for a fixed duration.
// ---------------------------------------------------------------------------

export interface StillsCaptureControls {
  takeStill: () => Promise<void>;
}

export interface StillsCaptureOptions {
  outDir: string;
  url: string;
  videoName?: string;
  viewport?: { width: number; height: number };
  warmupMs?: number;
  deviceScaleFactor?: number;
  /** Seconds each still appears in the final video. Default 0.5. */
  stillDurationSec?: number;
  crop?: { x: number; y: number; w: number; h: number };
  keepFrames?: boolean;
}

export async function captureStills(
  opts: StillsCaptureOptions,
  choreograph: (page: Page, ctrl: StillsCaptureControls) => Promise<void>,
): Promise<CaptureResult> {
  const viewport = opts.viewport ?? { width: 1280, height: 720 };
  const dpr = opts.deviceScaleFactor ?? 2;
  const stillDur = opts.stillDurationSec ?? 0.5;
  const stableName = (opts.videoName ?? 'clip') + '.mp4';

  await mkdir(opts.outDir, { recursive: true });
  const stillsDir = join(opts.outDir, '.stills');
  await rm(stillsDir, { recursive: true, force: true });
  await mkdir(stillsDir, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  const page = await context.newPage();

  await page.goto(opts.url, { waitUntil: 'load' });
  await page.waitForTimeout(opts.warmupMs ?? 1500);

  let stillIndex = 0;
  const ctrl: StillsCaptureControls = {
    takeStill: async () => {
      const name = String(stillIndex++).padStart(6, '0') + '.png';
      await page.screenshot({ path: join(stillsDir, name), type: 'png' });
    },
  };

  try {
    await choreograph(page, ctrl);
  } finally {
    await context.close();
    await browser.close();
  }

  if (stillIndex === 0) {
    throw new Error('captureStills: choreograph never called takeStill()');
  }

  // Slideshow via concat demuxer — each still held for stillDur seconds.
  const concatLines: string[] = [];
  for (let i = 0; i < stillIndex; i++) {
    const name = String(i).padStart(6, '0') + '.png';
    concatLines.push(`file '${join(stillsDir, name)}'`);
    concatLines.push(`duration ${stillDur.toFixed(4)}`);
  }
  // Last file repeated so the final still's duration is honoured.
  concatLines.push(
    `file '${join(stillsDir, String(stillIndex - 1).padStart(6, '0') + '.png')}'`,
  );
  const listFile = join(stillsDir, 'concat.txt');
  await writeFile(listFile, concatLines.join('\n'));

  const filters: string[] = [];
  if (opts.crop) {
    const c = opts.crop;
    filters.push(`crop=${c.w * dpr}:${c.h * dpr}:${c.x * dpr}:${c.y * dpr}`);
  }
  filters.push(`scale=${viewport.width}:${viewport.height}:flags=lanczos`);

  const outFile = join(opts.outDir, stableName);
  await rm(outFile, { force: true });

  const result = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listFile,
      // Stills slideshow → constant 30fps output, ffmpeg interpolates from
      // the `duration` directives in the concat list.
      '-r', '30',
      '-c:v', 'libx264',
      '-crf', '18',
      '-preset', 'slow',
      '-pix_fmt', 'yuv420p',
      '-vf', filters.join(','),
      '-movflags', '+faststart',
      outFile,
    ],
    { stdio: 'pipe' },
  );
  if (result.status !== 0) {
    throw new Error('ffmpeg failed:\n' + result.stderr.toString());
  }

  if (!opts.keepFrames) {
    await rm(stillsDir, { recursive: true, force: true });
  }

  return { videoPath: outFile };
}
