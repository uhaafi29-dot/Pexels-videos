# Why Your Brain Resists Change (v2)

A 20-second vertical (1080×1920, 30 fps) narrated 3D explainer built with
[Remotion](https://www.remotion.dev/) and Three.js (via `@remotion/three` /
React Three Fiber). Version 1 is preserved unchanged in
`../brain-resists-change-v1/`.

Everything is generated in code: no stock footage or models. The pathways are
a visual metaphor for how practice makes a behaviour easier. They are not
literal brain anatomy, and the video says so on screen.

## Structure: three sequences

| Time | Sequence | Picture | Narration |
| --- | --- | --- | --- |
| 0–4.5 s | **01 · The question** | Macro shot on a glowing, translucent brain pulls back to a close-up, then the camera dives inside | "Why is it so hard to change a habit, even one you want to change?" |
| 4.5–10 s | **02 · The familiar path** | Abstract neural space; the camera chases a signal down a thick, smooth fibre bundle, then settles on it firing rhythmically | "Each time we repeat a behavior, it can feel a little easier, until it's almost automatic." |
| 10–20 s | **03 · A new route** | Whip-pan back to the starting point: a faint, broken second route. The first attempts stutter and spark; each repetition fills the gaps, adds strands and speeds the signal, until both routes glow alike | "A new behavior takes a different route. At first, it needs more attention, and effort." / "But with practice, that new route can become familiar too." |

The transitions carry meaning: the dive (1→2) takes us *inside* the brain,
and the whip-pan (2→3) returns to the decision point where the new route
branches off. In sequence 3, a REPS counter and progress bar make the
repetition visible.

Captions are large (74 px, heavy weight) on a dark plate, one short phrase at
a time. Each word lights up as it's spoken, using word timestamps taken from
the narration audio.

## Quick start

```bash
cd brain-resists-change-v2
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
  three/World.tsx      abstract pathway world: fibre-bundle routes, neuron field
  three/BrainWeb.tsx   neurons and connections inside the brain (sequence 1)
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
its natural 1.0× pace. It runs fully offline. The generated
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

If a new line runs longer, move its start (`NARRATION` in `src/timeline.ts`) and update its phrase breaks (`PHRASES`).
The music ducks automatically under every line.

## Music & sound

`public/ambient.wav` is original: it's synthesised from code by
`scripts/generate-ambient.mts` (an evolving pad, airy noise, soft swells at
scene changes, and quiet chimes when a signal reaches its target), so there
are no licensing issues. In the mix it sits well below the voice and ducks
under each narration line.

## Tweaking

- Timing, sequences, pulses, narration placement, caption phrasing: `src/timeline.ts`
- Camera direction, shot by shot: `cameraAt()` in `src/three/Scene3D.tsx`
- Route colours: `FAMILIAR_COLOR` / `NEW_COLOR` in `src/three/Scene3D.tsx`
- Route shapes and the fibre-bundle look: `src/three/World.tsx`
- Captions, chapter titles, repetition counter, transitions: `src/overlay/Text.tsx`
