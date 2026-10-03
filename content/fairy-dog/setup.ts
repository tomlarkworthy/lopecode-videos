// Installs the "Fairy Dog" OBS profile + scene collection for streaming to Streamplace.
//   bun content/fairy-dog/setup.ts [--key <stream key>] [--force] [--launch]
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';

const NAME = 'Fairy Dog';
const FILE = 'Fairy_Dog'; // OBS's on-disk spelling of NAME
const W = 1920, H = 1080;

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const opt = (f: string) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);

const obsDir =
  process.env.OBS_CONFIG_DIR ?? join(homedir(), 'Library/Application Support/obs-studio');

// local.json holds the stream key and room name; gitignored.
const localPath = join(import.meta.dir, 'local.json');
const local: { streamKey: string; room: string } = existsSync(localPath)
  ? JSON.parse(readFileSync(localPath, 'utf8'))
  : { streamKey: '', room: `fairydog-${randomBytes(4).toString('hex')}` };
if (opt('--key')) local.streamKey = opt('--key')!;
writeFileSync(localPath, JSON.stringify(local, null, 2) + '\n');

const links = {
  cohost: `https://vdo.ninja/?room=${local.room}&push=cohost`,
  tom: `https://vdo.ninja/?room=${local.room}&push=tom`,
  obs: `https://vdo.ninja/?view=cohost&solo&room=${local.room}&cleanoutput`,
};

// ScreenCaptureKit sources are keyed on the display's UUID.
const swift = Bun.spawnSync(['swift', join(import.meta.dir, 'display-uuid.swift')]);
const displayUuid = swift.exitCode === 0 ? swift.stdout.toString().trim() : '';
if (!displayUuid) console.warn('display UUID lookup failed; pick the display in the Chrome source');

const source = (name: string, id: string, settings: object, extra: object = {}) => ({
  name,
  uuid: randomUUID(),
  id,
  versioned_id: id,
  settings,
  mixers: 255,
  sync: 0,
  flags: 0,
  volume: 1.0,
  balance: 0.5,
  enabled: true,
  muted: false,
  'push-to-mute': false,
  'push-to-mute-delay': 0,
  'push-to-talk': false,
  'push-to-talk-delay': 0,
  hotkeys: {},
  deinterlace_mode: 0,
  deinterlace_field_order: 0,
  monitoring_type: 0,
  private_settings: {},
  ...extra,
});

type Src = ReturnType<typeof source>;
type Place = { x?: number; y?: number; scale?: number; fit?: boolean };

const scene = (name: string, items: [Src, Place][]) =>
  source(name, 'scene', {
    custom_size: false,
    id_counter: items.length,
    items: items.map(([s, p], i) => ({
      name: s.name,
      source_uuid: s.uuid,
      visible: true,
      locked: false,
      rot: 0.0,
      pos: { x: p.x ?? 0, y: p.y ?? 0 },
      scale: { x: p.scale ?? 1, y: p.scale ?? 1 },
      align: 5,
      bounds_type: p.fit ? 2 : 0, // 2 = scale to inner bounds
      bounds_align: 0,
      bounds: { x: p.fit ? W : 0, y: p.fit ? H : 0 },
      crop_left: 0,
      crop_top: 0,
      crop_right: 0,
      crop_bottom: 0,
      id: i + 1,
      group_item_backup: false,
      scale_filter: 'disable',
      blend_method: 'default',
      blend_type: 'normal',
      show_transition: { duration: 0 },
      hide_transition: { duration: 0 },
      private_settings: {},
    })),
  });

// Muted: the cohost is already heard in a browser tab, so Chrome's audio would double them.
const chrome = source(
  'Chrome',
  'screen_capture',
  { type: 2, display_uuid: displayUuid, application: 'com.google.Chrome', show_cursor: true },
  { muted: true },
);
const cohost = source('Cohost (VDO.Ninja)', 'browser_source', {
  url: links.obs,
  width: 1280,
  height: 720,
  fps: 30,
  reroute_audio: true,
});
const mic = source('Mic', 'coreaudio_input_capture', { device_id: 'default' });

const pip = 0.375; // 1280x720 -> 480x270
const scenes = [
  scene('Desktop + Cohost', [
    [chrome, { fit: true }],
    [cohost, { x: W - 1280 * pip - 20, y: H - 720 * pip - 20, scale: pip }],
  ]),
  scene('Desktop', [[chrome, { fit: true }]]),
  scene('Cohost', [[cohost, { scale: W / 1280 }]]),
];

const collection = {
  name: NAME,
  current_scene: scenes[0].name,
  current_program_scene: scenes[0].name,
  scene_order: scenes.map((s) => ({ name: s.name })),
  sources: [chrome, cohost, ...scenes],
  groups: [],
  quick_transitions: [],
  transitions: [],
  saved_projectors: [],
  current_transition: 'Fade',
  transition_duration: 300,
  preview_locked: false,
  scaling_enabled: false,
  scaling_level: 0,
  scaling_off_x: 0.0,
  scaling_off_y: 0.0,
  modules: {},
  AuxAudioDevice1: mic,
};

// Streamplace's OBS guide: Advanced output, x264, CBR, 1s keyframes, bframes=0.
const basicIni = `[General]
Name=${NAME}

[Video]
BaseCX=${W}
BaseCY=${H}
OutputCX=${W}
OutputCY=${H}
FPSType=0
FPSCommon=30

[Audio]
SampleRate=48000
ChannelSetup=Stereo

[Output]
Mode=Advanced

[AdvOut]
Encoder=obs_x264
TrackIndex=1
Track1Bitrate=160
`;
const streamEncoder = {
  rate_control: 'CBR',
  bitrate: 4500,
  keyint_sec: 1,
  preset: 'veryfast',
  profile: 'high',
  x264opts: 'bframes=0',
};
const service = {
  type: 'rtmp_custom',
  settings: { server: 'rtmps://stream.place:1935/live', key: local.streamKey, use_auth: false },
};

const profileDir = join(obsDir, 'basic/profiles', FILE);
const scenesDir = join(obsDir, 'basic/scenes');
mkdirSync(profileDir, { recursive: true });
mkdirSync(scenesDir, { recursive: true });

const json = (o: object) => JSON.stringify(o, null, 2) + '\n';
writeFileSync(join(profileDir, 'basic.ini'), basicIni);
writeFileSync(join(profileDir, 'streamEncoder.json'), json(streamEncoder));
writeFileSync(join(profileDir, 'service.json'), json(service));

// Layout edits made in OBS live in the scene file, so it is only replaced on --force.
const scenePath = join(scenesDir, `${FILE}.json`);
if (existsSync(scenePath) && !flag('--force')) {
  console.log(`kept existing ${scenePath} (--force to regenerate)`);
} else {
  if (existsSync(scenePath)) copyFileSync(scenePath, `${scenePath}.${Date.now()}.bak`);
  writeFileSync(scenePath, json(collection));
  console.log(`wrote ${scenePath}`);
}
console.log(`wrote ${profileDir}`);

console.log(`
stream key : ${local.streamKey ? 'set' : 'MISSING — rerun with --key <key from stream.place Live Dashboard>'}
cohost link: ${links.cohost}
your link  : ${links.tom}
launch     : open -a OBS --args --profile "${NAME}" --collection "${NAME}"`);

if (flag('--launch')) {
  Bun.spawnSync(['open', '-a', 'OBS', '--args', '--profile', NAME, '--collection', NAME]);
}
