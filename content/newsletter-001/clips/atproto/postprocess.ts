// Speed-ramp the atproto clip down to ~8s. The whole clip is 12s but only
// three moments are information-bearing:
//   - source tile click + diff table appearing
//   - the title→rkey transformation as you type
//   - the success card with the at:// URI
// Cursor glides and the publish-progress churn are dead air. Speed those.
//
//   A  pre-click       (1.5×)  initial settle + glide to live-editor tile
//   B  click + diff    (1.0×)  tile clicks, diff computes, table paints
//   C  glide to title  (1.5×)  cursor traverses to title input
//   D  typing          (2.5×)  "Newsletter 001" types in, rkey auto-updates
//   E  glide to publish (1.5×) cursor traverses to Publish button
//   F  publishing      (2.0×)  uploading N/86 churn collapses
//   G  success         (1.0×)  the "Published" card with the at:// URI
//   H  hold            (+1.2s) freeze the final frame for the cut
//
// Boundaries are seconds into atproto.mp4. After a re-capture, re-derive by
// sampling `ffmpeg -i atproto.mp4 -vf fps=4 /tmp/f_%03d.png`:
//   T_CLICK   = source tile shows "● selected"
//   T_DIFF    = file table painted
//   T_TYPING_START = title input first character appears
//   T_TYPING_END   = "Newsletter 001" complete
//   T_PUBLISH = "checking existing record..." appears in footer
//   T_SUCCESS = "● Published" card replaces the form
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const dir = import.meta.dir;
const input = join(dir, 'atproto.mp4');
const output = join(dir, 'atproto-final.mp4');

const T_CLICK = 1.5;
const T_DIFF = 3.0;
const T_TYPING_START = 5.0;
const T_TYPING_END = 6.5;
const T_PUBLISH = 8.0;
const T_SUCCESS = 11.5;
const T_END = 12.0;

const filter = [
  `[0:v]trim=0:${T_CLICK},setpts=(PTS-STARTPTS)/1.5[a]`,
  `[0:v]trim=${T_CLICK}:${T_DIFF},setpts=PTS-STARTPTS[b]`,
  `[0:v]trim=${T_DIFF}:${T_TYPING_START},setpts=(PTS-STARTPTS)/1.5[c]`,
  `[0:v]trim=${T_TYPING_START}:${T_TYPING_END},setpts=(PTS-STARTPTS)/2.5[d]`,
  `[0:v]trim=${T_TYPING_END}:${T_PUBLISH},setpts=(PTS-STARTPTS)/1.5[e]`,
  `[0:v]trim=${T_PUBLISH}:${T_SUCCESS},setpts=(PTS-STARTPTS)/2.0[f]`,
  `[0:v]trim=${T_SUCCESS}:${T_END},setpts=PTS-STARTPTS[g]`,
  `[a][b][c][d][e][f][g]concat=n=7:v=1[cat]`,
  `[cat]tpad=stop_mode=clone:stop_duration=1.2[out]`,
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
console.log('atproto-final.mp4 written →', output);
