# The Old You Is Waiting

*Why you keep returning to your old habits.* A 48.9-second vertical
(1080×1920, 30 fps) narrated reel for **The Psychology of Becoming**, in the
page's minimalist 2D style (Remotion + SVG). The final video is
`renders/old-you.mp4`, and the caption is in `INSTAGRAM_CAPTION.md`.

## Story and metaphor

The central metaphor (concept C) is **the Outline**: faint, broken outlines of
the "old self" wait at the cues where a habit lives. The solid ivory figure
is the person; the outlines are a visual metaphor, labelled on screen.

| Beat | Narration | Picture |
| --- | --- | --- |
| Hook, 0–7.7 s | "On vacation, you're a different person… the old you is waiting." | A figure stretches in warm open space. By about 2.9 s the camera reveals a dark doorway, and inside, an outline of the same figure is already sitting up in bed with a phone. |
| Rising action, 8–13.8 s | "You try harder… scrolling in bed without deciding to." | A gold spark for trying. The window brightens three times, one tick per day. Then night: the figure fades and the outline in bed fills in solid. It became the old self. |
| Second conflict, 14–21.6 s | "…a strong habit doesn't wait for permission…" | A gold arrow (the intention) points out of the door. The phone lights and its worn-in outlines glow teal. The figure turns and its hands rise into the outline, and only then does a small gold "decision" dot appear. |
| Climax, 22–36.5 s | "…students who moved to a new university… habit discontinuity…" | The home dissolves into a new room. The old outlines break up and fall, except the one beside the phone the figure carried in. A gold arched window opens. |
| Resolution, 37–45 s | "So tonight, try an experiment… you can choose where it lives." | Back home at night, the phone goes outside the bedroom onto a shelf, and its outline moves with it, faint but still there. A book takes the phone's place. |
| CTA, 45.7–48.9 s | "Follow The Psychology of Becoming." | The figure reads in the exact spot where the old self waited, and a new gold outline begins to form, still incomplete. |

## Science

- **Strong habits are triggered by their cues regardless of current goals.**
  Established. Wood & Rünger (2016); Wood, Mazar & Neal (2022).
- **Transfer students' habits broke down in the new setting, except where
  parts of the old context stayed the same.** Established, from one
  well-known study: Wood, Tam & Witt (2005), *JPSP* 88(6). Shown on screen
  as the research note.
- **Habit discontinuity: a change of context can open a window for change.**
  A supported hypothesis with modest effects (Verplanken et al., 2008). The
  narration says "a window", not that change is guaranteed.
- **Charging the phone outside the bedroom** is framed as an experiment, not
  a guaranteed fix.

## Production

- **Narration:** Kokoro-82M with the `af_heart` voice, as in earlier reels. Most
  lines are read at 1.04×; the science lines and "You can't always out-will a
  cue…" are slightly slower (`LINE_SPEED` in `scripts/generate_voiceover.py`).
  Word timings come from forced alignment and drive the captions.
- **Sound:** `scripts/generate-ambient.ts` synthesises an original, restrained
  track from the same story beats (`src/anchors.ts`):
  - a pad, warm on vacation, cool at home, and warming as the window opens
  - a soft shimmer when the outline appears
  - a quiet notification when the cue lights up
  - a fine falling sparkle as the old outlines break up
  - two chime notes for the window
  - a tap as the phone is set down

  The music ducks under the voice and sits roughly 13–18 dB below it.
- **Captions:** word-synced, inside the Instagram safe area. The master is at −14 LUFS.

```bash
cd old-you
npm install
npm run studio     # preview and tweak in the browser
npm run render     # → out/old-you.mp4 (about 4 minutes here; faster on a Mac)
npm run audio      # regenerate the sound design after timing changes
npm run captions   # regenerate public/captions.srt
```

## Code map

```
src/timeline.ts   narration placement, caption phrasing
src/anchors.ts    story beats (seconds), shared by picture and sound
src/figure.tsx    the parametric silhouette, its poses, and the outline rendering
src/film.tsx      the one continuous stage: rooms, outlines, figure, camera
src/overlay.tsx   captions, research note, term, series sign-off
```
