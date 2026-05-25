import { capture, pause } from '../capture.ts';
import { join } from 'node:path';

// Adjust to the notebook that gives the cleanest LSP demo.
// parametric-svg has Inputs / d3 / htl in scope, which all surface good hover + completion.
const NOTEBOOK_PATH =
  '/Users/tom.larkworthy/dev/lopecode-dev/lopebooks/notebooks/@tomlarkworthy_parametric-svg.html';
const HASH =
  '#view=R100(S50(@tomlarkworthy/parametric-svg),S50(@tomlarkworthy/editor-5))';
const URL = `file://${NOTEBOOK_PATH}${HASH}`;

const OUT_DIR = join(import.meta.dir, '..', '..', 'content/newsletter-001/clips/lsp');

await capture(
  { url: URL, outDir: OUT_DIR, videoName: 'lsp', warmupMs: 2500 },
  async (page) => {
    // Focus the editor pane's first code surface.
    const editor = page.locator('.cm-content').first();
    await editor.click();
    await pause(page, 600);

    // Drop to a fresh line so we don't corrupt existing source, then type to trigger completion.
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await pause(page, 300);
    await page.keyboard.type('Inputs.r', { delay: 90 });
    await pause(page, 1200); // wait for completion popup

    // Explicit completion request as a fallback.
    await page.keyboard.press('Control+Space');
    await pause(page, 1500);

    // Accept first suggestion and open signature help.
    await page.keyboard.press('Enter');
    await pause(page, 400);
    await page.keyboard.type('(', { delay: 80 });
    await pause(page, 1500);

    // Escape so the demo ends on a clean shot.
    await page.keyboard.press('Escape');
    await pause(page, 500);
  },
);

console.log('lsp clip saved →', OUT_DIR);
