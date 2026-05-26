// Speed-ramp the linux boot clip AND hard-cut the dead "open the SBC notebook"
// transition. The raw capture rides the newsletter → linux-sbc navigation: a
// blank load flash, the SBC notebook's docs, and a "stopped / (no output yet)"
// pre-boot screen — none of which carry information. We cut from the newsletter
// straight to the boot sequence.
//
//   A  intro     (1×)  newsletter "Embedded Linux?" section
//   --- cut NEWS_END..BOOT_INTRO_START (nav flash + SBC docs + stopped) ---
//   B  bootstart (1×)  boot sequence begins — kernel log streams, readable
//   C  boot      (Nx)  the boot churn collapsed hard
//   D  payoff    (1×)  "=== Linux booted ===" + uname -a → riscv32 GNU/Linux
//   E  hold      (+1s) freeze the final frame so the uname result is readable
//
// Boundaries are seconds into the raw capture (linux.mp4). Boot timing drifts
// ~±1s per run; after a re-capture, re-derive by sampling
// `ffmpeg -i linux.mp4 -vf fps=2 /tmp/f_%03d.png`:
//   NEWS_END         = last frame the newsletter is shown (before the blank
//                      navigation flash to linux-sbc.html)
//   BOOT_INTRO_START = first frame the terminal is actually streaming boot
//                      output (NOT the "(no output yet)" stopped screen)
//   BOOT_CHURN_START = where the readable boot start ends and the long churn
//                      begins (keeps the bootstart segment legible)
//   BOOT_END         = "=== Linux booted ===" appears (payoff begins)
//   PAYOFF_END       = uname output fully printed (a beat after BOOT_END)
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const dir = import.meta.dir;
const input = join(dir, 'linux.mp4');
const output = join(dir, 'linux-final.mp4');

const NEWS_END = 1.0; // newsletter still on screen (blank nav flash at ~1.5s)
const BOOT_INTRO_START = 4.0; // terminal streaming boot output (past "no output yet")
const BOOT_CHURN_START = 5.0; // readable boot start ends, long churn begins
const BOOT_END = 18.5; // "=== Linux booted ===" appears
const PAYOFF_END = 20.8; // just after uname output settles (no static tail)
const BOOT_SPEED = 14; // collapse the churn
const HOLD_SEC = 1; // freeze-hold on the final uname frame

const filter = [
  `[0:v]trim=0:${NEWS_END},setpts=PTS-STARTPTS[a]`,
  `[0:v]trim=${BOOT_INTRO_START}:${BOOT_CHURN_START},setpts=PTS-STARTPTS[b]`,
  `[0:v]trim=${BOOT_CHURN_START}:${BOOT_END},setpts=(PTS-STARTPTS)/${BOOT_SPEED}[c]`,
  `[0:v]trim=${BOOT_END}:${PAYOFF_END},setpts=PTS-STARTPTS[d]`,
  `[a][b][c][d]concat=n=4:v=1[cat]`,
  `[cat]tpad=stop_mode=clone:stop_duration=${HOLD_SEC}[out]`,
].join(';');

const args = [
  '-y',
  '-i', input,
  '-filter_complex', filter,
  '-map', '[out]',
  '-c:v', 'libx264',
  '-crf', '18',
  '-preset', 'slow',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  output,
];

const res = spawnSync('ffmpeg', args, { stdio: 'inherit' });
if (res.status !== 0) {
  console.error('ffmpeg failed');
  process.exit(1);
}
console.log('linux-final.mp4 written →', output);
