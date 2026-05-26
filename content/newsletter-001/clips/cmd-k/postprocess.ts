// Drop the second-transition (code-search → parametric-svg jump) from the
// cmd-k clip. The first transition — palette opens on the newsletter, types
// "command palette", lands on @tomlarkworthy/command-palette — is the
// punchline; the second jump adds time without adding new information.
//
//   A  first transition (1×)  newsletter → palette → type → land on palette notebook
//   B  hold              (+0.6s) freeze on the landed page
//
// Boundary is seconds into cmd-k.mp4. After a re-capture, re-derive by
// sampling `ffmpeg -i cmd-k.mp4 -vf fps=4`:
//   T_END = clean frame on the @tomlarkworthy/command-palette notebook
//           BEFORE the second palette overlay opens with the "ro" search.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const dir = import.meta.dir;
const input = join(dir, 'cmd-k.mp4');
const output = join(dir, 'cmd-k-final.mp4');

const T_END = 3.5;
const HOLD_SEC = 0.6;

const filter = [
  `[0:v]trim=0:${T_END},setpts=PTS-STARTPTS[a]`,
  `[a]tpad=stop_mode=clone:stop_duration=${HOLD_SEC}[out]`,
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
console.log('cmd-k-final.mp4 written →', output);
