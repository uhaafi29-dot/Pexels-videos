# Why Your Brain Resists Change

A 20-second vertical (1080×1920, 30 fps) cinematic 3D explainer built with
[Remotion](https://www.remotion.dev/) and Three.js (via `@remotion/three` /
React Three Fiber).

The brain, pathways, particles and light are all generated in code: no
external models or footage. It's a conceptual metaphor for habit formation,
not an anatomical simulation.

| Time | Scene | On screen |
| --- | --- | --- |
| 0–4 s | Translucent glowing brain turns slowly | **Why does change feel so difficult?** |
| 4–9 s | A signal fires again and again along a familiar (blue) route | *Repeated behaviors can become easier and more automatic.* |
| 9–15 s | The signal hesitantly lights a different (aqua) route | *New behaviors often require more attention and practice.* |
| 15–20 s | Both routes stay visible; the new one brightens and speeds up with each repetition | **Repetition helps new habits become familiar.** |

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
  overlay/Text.tsx     titles, captions, route legend, disclaimer
scripts/generate-ambient.mts   synthesises public/ambient.wav from the timeline
public/
  ambient.wav          original ambient bed (pad, air, swells, synapse chimes)
  captions.srt         captions as a sidecar file
  voiceover/SCRIPT.md  voiceover lines and timing windows
```

Everything is deterministic (seeded noise and random numbers, no
`Math.random`), so every render gives the same frames.

## Voiceover

The video ships with on-screen captions and the ambient bed only. To add
narration, record the lines in `public/voiceover/SCRIPT.md`, put the files in
`public/voiceover/`, then pass them as props:

```bash
npx remotion render BrainResistsChange out/with-vo.mp4 \
  --props='{"ambient":"ambient.wav","voiceover":{"intro":null,"familiar":"scene2.wav","newRoute":"scene3.wav","repetition":null}}'
```

You can also edit `defaultProps` in `src/Video.tsx`. Each clip starts 0.2 s
into its scene.

## Sound

`npm run audio` regenerates `public/ambient.wav`. The chimes follow the
pulse schedule in `src/timeline.ts`, so if you change timings, rerun it to
keep the sound in sync.

## Tweaking

- Timing, pulse speed and caption text: `src/timeline.ts`
- Camera path: `CAMERA_KEYS` / `TARGET_KEYS` in `src/three/Scene3D.tsx` (one key every 2 s)
- Route colours: `FAMILIAR_COLOR` / `NEW_COLOR` in `src/three/Scene3D.tsx`
- Route shapes: `FAMILIAR_CURVE` / `NEW_CURVE` in `src/three/Pathways.tsx`
