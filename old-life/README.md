# Why Your Brain Keeps Pulling You Back to Your Old Life

A narrated, 64.5-second vertical (1080×1920, 30 fps) cinematic science reel
built with **Remotion + Three.js (React Three Fiber)**: real-time 3D rooms,
a rigged faceless figure, physically based materials, real shadows and
post-processing. It reuses the narration, subtitle and sound pipeline from
`../brain-resists-change-v2/` and `../double-slit/`, which are unchanged.

## The film

| Time | Scene | What happens |
| --- | --- | --- |
| 0–10.1 s | **1 · The hook** | Sunrise in a hotel suite with floor-to-ceiling glass. The figure stretches at the window, walks briskly past the bed, and heads for the door. Title: *WHY DOES THE OLD YOU COME BACK?* |
| 10.1–16.5 s | **2 · The return** | Match cut: the same framing, a different doorway, midnight blue instead of gold. The posture slumps. A high wide shot shows the same walk repeating, with translucent echoes. The clock reads 11:47. |
| 16.5–31.6 s | **3 · The mechanism** | Luminous threads grow from the cues (bed, clock, lamp, desk, chair, phone) to the figure while the camera orbits. "The same room / time / cues" each get their own shot. The phone lights up, a pulse runs down its thread, and the hands come up before any "decision". |
| 31.6–43.6 s | **4 · The science** | The room darkens into a miniature, and **HABIT DISCONTINUITY effect** is set in editorial type. The figure enters a different room. The old threads reach out and find nothing to hold, so they break up and fade. A faint gold thread forms toward the light. |
| 43.6–57.7 s | **5 · The experiment** | Back at night. The figure carries the phone away from the bed to the desk, and that cue's thread stretches, dims and flickers. A time-lapse runs to morning: the chair moves to the window, a glass of water replaces the phone, the curtains open. New gold threads are still faint, because a new routine takes repetition. |
| 57.7–64.5 s | **6 · The payoff** | The same room in warm sunrise light, with a slow pull-back. *CHANGE THE CUE. CHANGE THE POSSIBILITY.* / *Follow for the hidden science of becoming.* |

## What's real 3D, generated, or motion graphics

- **True 3D, rendered per frame:**
  - both rooms: geometry with real door and window openings, a PBR wood floor, a rumpled duvet, curtains, furniture, the clock and the phone
  - lighting: sun or moon through the windows with real soft shadow maps, HDRI image-based lighting, and the sky seen through the hotel glass
  - the figure (rigged, skinned and animated) and its echoes
  - the camera moves, which are all real 3D camera paths
- **Real assets** (all free, see credits):
  - the figure: Mixamo "X Bot", with its idle, walk and slumped "sad" clips
  - the velvet chair, velvet sofa and plant models
  - the sunrise and night HDRIs, which also supply the landscape outside the hotel
  - the wood textures
- **Procedural / programmatic:**
  - the arm and head poses (phone, carry, stretch), solved in code on top of the clips
  - the cue threads, light shafts and dust motes (shaders)
  - the night city outside the bedroom window, which crossfades to sunrise
  - the clock face
- **Motion graphics (2D overlay):** titles, the science term, the metaphor note, captions and the call to action.
- **Labelled metaphor:** the threads are a visual metaphor for learned cue → behaviour associations, not neural wiring. The film says so on screen.

## Limitations

- **The figure is a mannequin, not a person.** No photoreal human was
  available with the free assets reachable here.
- **Only walk, idle and slump are motion-captured.** Picking up the phone,
  carrying it and stretching are procedural poses blended on top. They read
  clearly, but they're simpler than real motion capture: no finger grip, and
  the phone appears in the hands rather than being visibly grasped.
- **The rooms are clean architectural-visualization interiors**, not
  photographs. There's no path-traced global illumination; bounce light is
  approximated with HDRI and fill lights.
- **Cloud renders are slow.** This container has no GPU, so rendering here
  takes about an hour. A Mac with Apple Silicon renders it in a few minutes.

## Narration

Kokoro-82M (Apache-2.0, offline) with the `af_heart` voice, the same as the
earlier videos, at 1.04× speed. The script is verbatim apart from the
ellipsis being written as "...". The word timings in `src/voiceover.json`
come from pocketsphinx forced alignment and drive the captions.

To regenerate it, follow the setup steps in `../double-slit/README.md`, then
run `npm run voiceover && npm run captions && npm run audio`.

## Sound

`scripts/generate-ambient.ts` synthesises an original track from the same
story code as the picture:

- **music:** a warm major pad in the light that turns to a cool minor at night
- **room tone:** morning air and distant birds; at night, a low hum and a clock tick
- **footsteps:** generated from the figure's actual walk cycle, on stone in the hotel and wood at home
- **story cues:** the phone notification, the phone set down, the curtains drawn, and swells on the big cuts

The music ducks under the voice.

## Science

The script's careful wording ("can", "some of their power") matches the
evidence:

- **[Wood & Rünger 2016](https://dornsife.usc.edu/wendy-wood/wp-content/uploads/sites/183/2023/10/wood.runger.2016.pdf), "Psychology of Habit", Annual Review of Psychology 67.**
  Repeated responses in stable contexts come to be cued by that context,
  automatically.
- **[Wood, Tam & Witt 2005](https://dornsife.usc.edu/wendy-wood/wp-content/uploads/sites/183/2023/10/Wood.Tam_.GuerreroWitt.2005_Changing_circumstances_disrupting_habits.pdf), JPSP 88(6).**
  When students transferred universities, habits whose usual cues changed
  were disrupted, while behaviour guided by intentions was not.
- **[Verplanken, Walker, Davis & Jurasek 2008](https://researchportal.bath.ac.uk/en/publications/context-change-and-travel-mode-choice-combining-the-habit-discont/), J. Environmental Psychology 28.**
  The habit discontinuity hypothesis: after moving house, environmentally
  concerned people drove to work less.

The effects are modest and the change is not automatic. The film shows a new
routine as faint and still forming, and doesn't claim identity changes on
its own.

## Asset credits

- **"X Bot"** by Mixamo / Adobe, via the three.js examples. Royalty-free for use in projects.
- **"Sheen Chair"** by Eric Chadwick, from the Khronos glTF Sample Assets. CC0.
- **"Glam Velvet Sofa"** by Eric Chadwick, from the Khronos glTF Sample Assets. CC-BY 4.0.
- **"Diffuse Transmission Plant"** by Eric Chadwick and Rico Cilliers, from the Khronos glTF Sample Assets. CC-BY 4.0.
- **HDRIs "Spruit Sunrise" and "Moonless Golf"**, from Poly Haven via the three.js examples. CC0.
- **Hardwood textures**, from the three.js examples.

If you need to credit the CC-BY assets publicly, a line in the Instagram caption is enough:
"3D assets: Eric Chadwick / Khronos (CC-BY 4.0)".

## Render

```bash
cd old-life
npm install
npm run studio     # preview and scrub in the browser
npm run render     # → out/old-life.mp4 (a few minutes on a Mac)
ffmpeg -i out/old-life.mp4 -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=7 -c:a aac -b:a 192k out/old-life-final.mp4
```

## Code map

```
src/timeline.ts         narration placement, scene cuts, caption phrases
src/story.ts            the film as a function of the frame: camera, figure, props, light, threads
src/three/Rooms.tsx     bedroom, hotel suite, corridors, light shafts, dust
src/three/Character.tsx the figure: clip blending + procedural arm/head poses
src/three/Threads.tsx   the cue threads (shader)
src/three/Lighting.tsx  golden morning / midnight-to-dawn light rigs
src/three/Scene3D.tsx   assembles each frame + post-processing
src/overlay/Text.tsx    titles, science type, captions, CTA
```
