import { capture, pause } from '../../../../src/capture.ts';

const NOTEBOOK_PATH =
  '/Users/tom.larkworthy/dev/lopecode-dev/lopebooks/notebooks/@tomlarkworthy_parametric-svg.html';
const HASH =
  '#view=R100(S50(@tomlarkworthy/parametric-svg),S50(@tomlarkworthy/editor-5))';
const URL = `file://${NOTEBOOK_PATH}${HASH}`;

await capture(
  { url: URL, outDir: import.meta.dir, videoName: 'lsp', warmupMs: 2500 },
  async (page) => {
    const editor = page.locator('.cm-content').first();
    await editor.click();
    await pause(page, 600);

    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await pause(page, 300);
    await page.keyboard.type('Inputs.r', { delay: 90 });
    await pause(page, 1200);

    await page.keyboard.press('Control+Space');
    await pause(page, 1500);

    await page.keyboard.press('Enter');
    await pause(page, 400);
    await page.keyboard.type('(', { delay: 80 });
    await pause(page, 1500);

    await page.keyboard.press('Escape');
    await pause(page, 500);
  },
);

console.log('lsp clip saved →', import.meta.dir);
