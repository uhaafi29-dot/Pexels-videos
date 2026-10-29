# Why Your Brain Resists Change

A 20-second vertical (1080×1920, 30 fps) cinematic 3D explainer built with
[Remotion](https://www.remotion.dev/) and Three.js (via `@remotion/three` /
React Three Fiber).

The brain, pathways, particles and light are all generated in code: no
external models or footage. It's a conceptual metaphor for habit formation,
not an anatomical simulation.

Fully narrated by a neural text-to-speech voice. Subtitles reveal each word
as it is spoken, and the animation is timed to the narration.

| Time | Scene | Narration (also shown as synced subtitles) |
| --- | --- | --- |
| 0–4 s | Translucent glowing brain turns slowly | "Why does change feel so difficult?" (on-screen title) |
| 4–9 s | A signal fires again and again along a familiar (blue) route | "Every time we repeat a behavior, it can become easier, and more automatic." |
| 9–15 s | The signal hesitantly lights a different (aqua) route | "New behaviors take a different route. They often require more attention, and practice." |
| 15–20 s | Both routes stay visible; the new one brightens and speeds up with each repetition | "The good news? Repetition helps new habits become familiar." (on-screen title) |

## Quick start

```bash
cd brain-resists-change
npm install
npm run studio        # live preview in the browser (scrub, play, tweak)
npm run render        # → out/brain-resists-change.mp4
```

### Rendering on a machine without a GPU

WebGL needs a GL backend in headless Chrome. On servers, CI or containers
without a GPU, use SwiftShader:

```bash
npm run render:cpu
# same as: npx remotion render BrainResistsChange out/brain-resists-change.mp4 --gl=swangle
```

If Remotion can't download its own Chrome, point it at an existing
Chromium / Chrome Headless Shell with
`--browser-executable=/path/to/chrome-headless-shell`.

Export settings (in `remotion.config.ts`): H.264, CRF 16, yuv420p, AAC
audio, which works on Instagram Reels, TikTok and YouTube Shorts.

## Project layout

```
src/
  timeline.ts          scene timings, signal pulses, caption text (single source of truth)
  Video.tsx            composition: 3D canvas + text overlay + audio
  three/Scene3D.tsx    camera path, brain rotation, per-frame animation values
  three/Brain.tsx      procedural translucent brain (folded hemispheres, cerebellum, stem)
  three/Pathways.tsx   familiar/new routes (glowing tubes with travelling pulses), neural web
  three/Glow.tsx       additive glow sprites (neurons, signal heads, synapse flashes)
  three/Atmosphere.tsx backdrop haze, light shafts, bokeh dust, vignette & fades
  overlay/Text.tsx     word-synced titles & subtitles, route legend, disclaimer
  voiceover.json       narration text, durations and word timestamps (generated)
scripts/
  generate_voiceover.py   Kokoro TTS narration + forced-alignment word timings
  generate-ambient.mts    synthesises public/ambient.wav from the timeline
  export-captions.mts     writes public/captions.srt
public/
  voiceover/*.wav      generated narration lines
  ambient.wav          original music bed (pad, air, swells, synapse chimes)
  captions.srt         subtitles as a sidecar file (they are also burned in)
```

Everything is deterministic (seeded noise and random numbers, no
`Math.random`), so every render gives the same frames.

## Narration

The voice is **Kokoro-82M** (Apache-2.0 open-weight TTS model) with the
`af_heart` voice: a warm, natural American English female voice, read at
0.95× speed for a calm documentary pace. It runs fully offline. The generated
lines are committed in `public/voiceover/`, and their word-level timestamps
(from pocketsphinx forced alignment) are in `src/voiceover.json`. Those
timestamps drive the subtitles.

To change the script, edit `LINES` in `scripts/generate_voiceover.py`, then:

```bash
pip install kokoro-onnx pocketsphinx soundfile scipy
# model weights + voice style vectors, both distributed on npm:
mkdir -p tts && cd tts
npm pack kokoro-q8-shards@1.0.0 kokoro-js@1.2.1
tar xzf kokoro-q8-shards-1.0.0.tgz && cat package/kokoro-q8.part{0..5}.bin > kokoro-q8.onnx
#   sha256 should be fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478
tar xzf kokoro-js-1.2.1.tgz && mv package/voices voices && rm -rf package *.tgz
cd ..
npm run voiceover   # → public/voiceover/*.wav + src/voiceover.json
npm run captions    # → public/captions.srt
npm run audio       # re-sync the music bed's chimes
```

If a new line runs longer, move its start (`NARRATION` in `src/timeline.ts`).
The music ducks automatically under every line.

## Music & sound

`public/ambient.wav` is original: it's synthesised from code by
`scripts/generate-ambient.mts` (an evolving pad, airy noise, soft swells at
scene changes, and quiet chimes when a signal reaches its target), so there
are no licensing issues. In the mix it sits well below the voice and ducks
under each narration line.

## Tweaking

- Timing, pulse speed and narration placement: `src/timeline.ts`
- Camera path: `CAMERA_KEYS` / `TARGET_KEYS` in `src/three/Scene3D.tsx` (one key every 2 s)
- Route colours: `FAMILIAR_COLOR` / `NEW_COLOR` in `src/three/Scene3D.tsx`
- Route shapes: `FAMILIAR_CURVE` / `NEW_CURVE` in `src/three/Pathways.tsx`
