// One-time auth helper. Launches Playwright with a persistent user-data-dir,
// opens the at-write publishWidget, and waits for you to manually sign in.
// Run this once; the resulting session persists in USER_DATA_DIR and is
// reused by clip.ts. Re-run if the session expires.
//
//   bun content/newsletter-001/clips/atproto/auth.ts
//
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// Keep the auth profile inside the repo (under `.auth/`, gitignored). The
// sandbox the agent runs under blocks writes to `~/...`, and `/tmp/...` is
// volatile so the saved session wouldn't survive reboots.
const USER_DATA_DIR = resolve(import.meta.dir, '../../../../.auth/chrome-profile');

const NOTEBOOK_PATH =
  '/Users/tom.larkworthy/dev/lopecode-dev/lopebooks/notebooks/@tomlarkworthy_lopecode-newsletter-001.html';
const HASH = '#view=R100(@tomlarkworthy/lopecode-newsletter-001,S50(@tomlarkworthy/at-write))';
const URL = `file://${NOTEBOOK_PATH}${HASH}`;

await mkdir(USER_DATA_DIR, { recursive: true });
console.log(`Using user-data-dir: ${USER_DATA_DIR}`);

const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: false,
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 2,
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(URL, { waitUntil: 'load' });

console.log('');
console.log('============================================================');
console.log('Sign into Bluesky/ATProto in the at-write pane (right side).');
console.log('When you see "● <handle> ▾" in place of "● sign in ▾", you are');
console.log('done — close this window or press Ctrl-C in the terminal.');
console.log('============================================================');

// Poll once a minute for a signed-in handle. When detected, print confirmation
// (but do not auto-close so the user has time to confirm visually).
let lastHandle: string | null = null;
const interval = setInterval(async () => {
  try {
    const handle = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
      const signInBtn = btns.find((b) => /sign in/i.test((b as HTMLElement).textContent ?? ''));
      if (signInBtn) return null;
      const handleEl = btns.find((b) =>
        /^●\s*[\w.-]+\s*▾$/.test(((b as HTMLElement).textContent ?? '').trim()),
      );
      return handleEl ? (handleEl as HTMLElement).textContent?.trim() ?? null : null;
    });
    if (handle && handle !== lastHandle) {
      lastHandle = handle;
      console.log(`Detected signed in as: ${handle}`);
      console.log('Session is saved. You can close the browser now.');
    }
  } catch {}
}, 5000);

await new Promise<void>((resolve) => {
  ctx.once('close', () => {
    clearInterval(interval);
    resolve();
  });
});
console.log('Browser closed. Auth helper exiting.');
