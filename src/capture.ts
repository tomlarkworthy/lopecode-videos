import { chromium, type Page } from 'playwright';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

export interface CaptureOptions {
  outDir: string;
  url: string;
  videoName?: string;
  viewport?: { width: number; height: number };
  warmupMs?: number;
}

export interface CaptureResult {
  videoPath: string;
}

export async function capture(
  opts: CaptureOptions,
  choreograph: (page: Page) => Promise<void>,
): Promise<CaptureResult> {
  const viewport = opts.viewport ?? { width: 1280, height: 720 };
  await mkdir(opts.outDir, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: opts.outDir, size: viewport },
  });
  const page = await context.newPage();
  await page.goto(opts.url, { waitUntil: 'load' });
  await page.waitForTimeout(opts.warmupMs ?? 1500);

  try {
    await choreograph(page);
  } finally {
    await context.close();
    await browser.close();
  }

  // Playwright names videos with random ids; rename to a stable filename.
  const stableName = (opts.videoName ?? 'clip') + '.webm';
  const target = join(opts.outDir, stableName);
  const entries = await readdir(opts.outDir);
  const generated = entries.find((f) => f.endsWith('.webm') && f !== stableName);
  if (!generated) throw new Error('No video recorded');
  await rm(target, { force: true });
  await rename(join(opts.outDir, generated), target);
  return { videoPath: target };
}

export async function pause(page: Page, ms = 400) {
  await page.waitForTimeout(ms);
}

export async function glide(page: Page, x: number, y: number, steps = 30) {
  await page.mouse.move(x, y, { steps });
}
