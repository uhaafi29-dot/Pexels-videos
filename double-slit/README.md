# The Double-Slit Experiment

**"The Experiment That Changed How We Understand Reality"**: a 37-second
vertical (1080×1920, 30 fps) narrated 3D science explainer, built with
[Remotion](https://www.remotion.dev/) and Three.js (via `@remotion/three`).
It uses the same production setup and narration voice as
`../brain-resists-change-v2/`, which is left unchanged.

Everything is generated in code: no stock footage, models or samples. The
apparatus and the changing detection patterns are the main characters.

## Scenes

| Time | Scene | Picture | On-screen text |
| --- | --- | --- | --- |
| 0–5.5 s | 1 · The apparatus | Looking down the beam line: electron source, double slit, detector screen. The camera pushes toward the slits as one electron is fired | Can one particle behave like a wave? |
| 5.5–12.1 s | 2 · Single detections | The camera orbits to face the screen; hits arrive one at a time as localized dots, then faster | One electron at a time. |
| 12.1–21 s | 3 · Interference | Thousands of hits reveal fringes; a gold theory curve draws above the screen; a crane over the screen reveals the calculated probability fanning out from the slits | An interference pattern emerges. |
| 21–29.2 s | 4 · Which-path information | An idealized which-path detector switches on at the slits; the first screen moves aside and a new run builds up a single broad band with no fringes | Measurement changes the pattern. |
| 29.2–37 s | 5 · Comparison | Slow pull-back to both results side by side, labelled *without* / *with path information* | Quantum physics challenges everyday intuition. |

The video runs 37 s rather than 35 s so the narration (28 s of speech) never
has to be rushed.

## Narration

The voice is **Kokoro-82M** (Apache-2.0 open-weight TTS) with the `af_heart`
voice, the same as *Why Your Brain Resists Change v2*. It runs offline. The
lines are in `scripts/generate_voiceover.py`. The generated WAVs live in
`public/voiceover/`, and their word-level timings (from pocketsphinx forced
alignment) in `src/voiceover.json`. Those timings drive the subtitles.

1. "What happens when we send electrons, one at a time, toward two tiny openings?"
2. "Each electron arrives as a single spot. But something surprising happens as the spots build up."
3. "Together, they form an interference pattern, revealing the wave-like behavior of quantum particles."
4. "When the experiment reveals which slit an electron takes, that interference disappears."
5. "Not because a human mind controls reality, but because quantum behavior is different from everyday experience."

## Scientific notes

- **The dots are a simulation, not lab data.** They're sampled from the
  standard far-field two-slit prediction (`src/physics.ts`):
  - **No path information:** P(x) ∝ |ψ₁ + ψ₂|², which is the single-slit
    envelope × cos² fringes.
  - **With path information:** P(x) ∝ |ψ₁|² + |ψ₂|², the same envelope with
    no interference term.
  The video says so on screen.
- **Each electron is detected as one localized event**, and the
  interference only shows up in the accumulated distribution. This matches
  the single-electron build-up experiments (Tonomura et al. 1989; Bach et
  al. 2013).
- **The glowing fan in scene 3 is the calculated, time-averaged
  probability density** from two slits. It is labelled as a visualization,
  not a water wave. The gold curve is the theoretical prediction, drawn
  separately from the hits.
- **The electron's flight in scene 1 is labelled as a metaphor**: only
  arrivals are detected. No path through either slit is drawn.
- **The which-path detector is idealized.** Interference disappears when
  the two paths become distinguishable (usable which-path information).
  That is a physical interaction, not anyone's awareness: no conscious
  observer is needed. The narration says so explicitly.

Sources:

- [Tonomura et al., "Demonstration of single-electron buildup of an interference pattern", Am. J. Phys. 57, 117 (1989)](https://www.physicsforums.com/attachments/tonomura1989-electron-slit-experiment-pdf.369001/)
- [Bach, Pope, Liou & Batelaan, "Controlled double-slit electron diffraction", New J. Phys. 15, 033018 (2013)](https://arxiv.org/pdf/1210.6243)
- [The Feynman Lectures on Physics, Vol. III ch. 1 "Quantum Behavior"](https://www.feynmanlectures.caltech.edu/III_01.html)
- [Stanford Encyclopedia of Philosophy, "The Role of Decoherence in Quantum Mechanics"](https://plato.stanford.edu/entries/qm-decoherence/)
- [Quantum decoherence review (arXiv:1911.06282)](https://arxiv.org/pdf/1911.06282): the better the paths can be distinguished, the less visible the interference

## Instagram safe areas

All text stays clear of the Reels interface:

- **Titles** sit below the top ~200 px.
- **Subtitles** sit 520 px above the bottom, in a centred column, away from
  the caption, audio row and action buttons.
- **The 3D action** is lens-shifted into the "stage" band between titles and
  subtitles. Labels that would leave that band are hidden.

## Quick start

```bash
cd double-slit
npm install
npm run studio     # live preview in the browser
npm run render     # → out/double-slit.mp4 (fast on a Mac / any machine with a GPU)
npm run render:cpu # GPU-less servers (SwiftShader); slow
```

Optional final loudness pass for social platforms (−14 LUFS):

```bash
ffmpeg -i out/double-slit.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=7 -c:a aac -b:a 192k out/double-slit-final.mp4
```

## Sound

`public/ambient.wav` is original, synthesised by `scripts/generate-ambient.mts`
from the same timeline:

- an evolving pad and air
- swells under the big camera moves
- a soft tick for every detected electron, which thins into a fine crackle
  as the hits pile up
- blips from the which-path detector

Music ducks under every narration line. Run `npm run audio` after changing
timings.

## Changing the narration

```bash
pip install kokoro-onnx pocketsphinx soundfile scipy
mkdir -p tts && cd tts
npm pack kokoro-q8-shards@1.0.0 kokoro-js@1.2.1
tar xzf kokoro-q8-shards-1.0.0.tgz && cat package/kokoro-q8.part{0..5}.bin > kokoro-q8.onnx
tar xzf kokoro-js-1.2.1.tgz && mv package/voices voices && rm -rf package *.tgz
cd ..
npm run voiceover && npm run captions && npm run audio
```

If a line's length changes, adjust `NARRATION` and `PHRASES` in
`src/timeline.ts`.

## Layout

```
src/
  timeline.ts        scenes, narration placement, caption phrases, detection schedule
  physics.ts         two-slit probability model + deterministic hit sampling
  camera.ts          shot-by-shot camera direction (shared with the label overlay)
  three/Apparatus.tsx source, slits, which-path detector, screens, probability field
  three/Scene3D.tsx  per-frame experiment state
  overlay/Text.tsx   scene titles, subtitles, anchored labels, counter, notes
```
