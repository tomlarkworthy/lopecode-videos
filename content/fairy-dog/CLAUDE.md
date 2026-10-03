# Fairy Dog — live stream setup

Not a clip series. `setup.ts` writes an OBS profile and scene collection named "Fairy Dog" for
streaming to [Streamplace](https://stream.place) with a remote cohost. Added 2026-10-02.

```bash
bun content/fairy-dog/setup.ts --key <stream key> --launch
```

The stream key comes from stream.place → Live Dashboard → Stream from OBS → RTMP → Generate
Stream Key. It and the VDO.Ninja room name are stored in `local.json` (gitignored). Rerunning
prints the cohost link again.

## Status: loads in OBS; encoder settings not yet seen in a live stream

First launch, 2026-10-02 18:18 (`logs/2026-10-02 18-16-44.txt`): the profile and collection were
selected from the command line, all three scenes and the global mic loaded, and the stream key
connected:

```
Loaded scenes: 'Desktop + Cohost', 'Desktop', 'Cohost'
[rtmp stream: 'test_stream'] Connection to rtmps://stream.place:1935/live (38.91.102.16) successful
```

That `test_stream` was OBS's first-run **Auto-Configuration Wizard, which then overwrote the
profile**: `Mode=Advanced` became `Mode=Simple` with `StreamEncoder=apple_h264`, `VBitrate=10000`
and `FPSCommon=60`. Simple mode ignores `streamEncoder.json`, so `bframes=0` and the 1 s keyframe
were no longer in effect. `basic.ini` was patched back to `Mode=Advanced` / `FPSCommon=30` by hand
at 18:24 with OBS closed (the wizard's version is kept as `basic.ini.wizard.bak`). Cancel the
wizard if it appears again; rerunning `setup.ts` also restores the profile.

Used for a first session on 2026-10-02 (Tom + cohost Scott). What that showed:

- **Application capture came up black with only the cursor.** OBS had saved `"application": ""`
  over the generated `com.google.Chrome`, probably because Screen Recording permission was not yet
  granted when it first enumerated apps. Re-picking Google Chrome in the source fixed it.
- **The VDO.Ninja solo link put the cohost on screen**, so the link shapes work.
- **No camera for Tom** was generated. Added by hand in OBS as `Tom` (`macos-avcapture`, MacBook
  Pro Camera). `setup.ts` does not produce it yet.
- Tom shared the OBS window into VDO.Ninja so the cohost could see the programme output.

`obs/Fairy_Dog.json` is the scene collection as OBS saved it at 2026-10-02 22:17, with both
hand fixes; it contains no stream key. To restore it, copy it to
`~/Library/Application Support/obs-studio/basic/scenes/` with OBS closed. `notes.md` is Tom's
running order of which link opens in which browser.

The x264 `bframes=0` setting has still not been confirmed from a log of a real stream.

## What it configures

Encoder settings follow the [Streamplace OBS guide](https://stream.place/docs/guides/start-streaming/obs/),
which says keyframe interval and B-frames are the two that make playback choppy when wrong:
Advanced output, x264, CBR, 1 s keyframes, `bframes=0`, server `rtmps://stream.place:1935/live`.
The guide gives no bitrate or resolution; 1920×1080, 30 fps, 4500 kbps are this script's choice.

Scenes: `Desktop + Cohost` (Chrome full frame, cohost 480×270 bottom right), `Desktop`, `Cohost`.
The mic is a global audio device, so it is live in all three.

- **Chrome** is application capture of `com.google.Chrome`, so every Chrome window on the main
  display is on stream, including the VDO.Ninja tab if it is opened in Chrome. Take the call in
  another browser, or change the source's Method to Window Capture (a window id does not survive
  a restart, which is why the script cannot preset it) or Display Capture and Option-drag to crop.
- **Chrome's audio is muted in the mixer.** The cohost is heard through the VDO.Ninja tab; with
  Chrome audio live they would be on stream twice. Unmute it only when the call is not in Chrome.
- **Cohost** is a browser source on the VDO.Ninja solo view link with "Control audio via OBS".
  Both people open their own `push` link in a browser to talk; headphones on both ends.

The scene file is only regenerated with `--force` (the old one is kept as `.bak`), because layout
changes made in OBS are stored there. The profile is rewritten on every run.
