// Hard-cut the dead intro of the exporter clip. The capture spends ~3s on a
// static two-pane frame before the Download click — the CDP screencast can't
// render the cursor, so the pre-click glide reads as motionless. Skip it.
//
//   A  action  (1×)  manifest table expands → download pill slides up
//   B  hold    (+0.6s) freeze the final frame so the file pill is readable
//
// Boundary is seconds into exporter.mp4. After a re-capture, re-derive by
// sampling `ffmpeg -i exporter.mp4 -vf fps=4 /tmp/f_%03d.png`:
//   T_ACTION = the export-manifest table first starts expanding (frame
//              where the right-pane Download area visibly grows). The pill
//              follows ~0.5s later; cutting to here keeps a beat of UI
//              before the pill arrives.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const dir = import.meta.dir;
const input = join(dir, 'exporter.mp4');
const output = join(dir, 'exporter-final.mp4');

const T_ACTION = 3.0;
const T_END = 4.6;
const HOLD_SEC = 0.6;

const filter = [
  `[0:v]trim=${T_ACTION}:${T_END},setpts=PTS-STARTPTS[a]`,
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
console.log('exporter-final.mp4 written →', output);
