# Psychology Reels: Standing Direction

This repository produces narrated vertical reels (1080×1920, 30 fps) for a
faceless educational page about psychology, identity shifts, human behaviour,
neuroscience and personal transformation. These rules apply to **every** reel.

## Approval gates (do not skip)

1. **Script gate.** Evaluate and improve the script against the content rules
   below. Show the revised script, the central visual metaphor, the scientific
   basis and the intended purpose. **Wait for approval.**
2. **Storyboard gate.** Before coding, present storyboard concepts (three when
   asked) showing how the central metaphor evolves from beginning to end.
   **Wait for approval.**
3. Only then build, render and run the quality checks.

## Content strategy rules

1. **Audience:** people who want to understand themselves, change old
   patterns, make better decisions and live more intentionally.
2. **Hook:** open with a relatable experience, a contradiction or a
   surprising question. No generic motivational openings.
3. **Curiosity:** open a question in the first 3 seconds, give a meaningful
   early clue, then reveal the full explanation without unnecessary delay.
4. **Credibility:** ground claims in real research. Name the concept or study
   where useful. Never invent statistics, credentials, studies or outcomes.
5. **Practical value:** one specific action, mental exercise or perspective
   shift. Never vague advice like "just change your mindset".
6. **Follow-worthy ending:** connect to one of the recurring content series
   with a natural, concise, non-salesy CTA. Known series: **The Psychology
   of Becoming**.
7. **Retention:** cut filler, repetition and unnecessary explanation. Every
   sentence must create curiosity, deepen understanding or deliver value.
8. **Visual storytelling:** premium minimalist 2D animation with one evolving
   visual metaphor that explains the mechanism.
9. **Scientific integrity:** label what is an established finding, what is an
   emerging hypothesis, and what is a metaphor. Never claim quantum physics
   proves manifestation, or that thoughts directly control external events.
10. **Final review:** does the viewer have a compelling reason to watch, save,
    share and follow?

## Storytelling and retention rules

Tell a story; don't just present information. Use this structure when it
fits, and vary it for science demonstrations, practical exercises and
research-based stories:

1. **Hook:** a relatable contradiction, mystery or specific problem.
2. **Rising action:** how the problem develops and why it matters.
3. **Second conflict:** a genuine, unexpected complication, misconception or
   contradiction.
4. **Climax:** reveal the psychological mechanism or discovery that explains
   it, at a satisfying moment rather than after a long introduction.
5. **Resolution:** a clear, useful takeaway that resolves the opening mystery.

- Make the viewer feel personally connected to the problem.
- Sustain curiosity, but never withhold essential information artificially.
- Never invent personal stories, experiments, findings or transformations.
  Relatable "you" scenarios are fine; fabricated anecdotes are not.
- Keep the narration natural and conversational, never melodramatic.
- Use one evolving 2D metaphor for the whole story. The climax should be a
  meaningful transformation, not a pile of effects.
- End on a useful insight, action or perspective shift. Add a short CTA only
  when it feels natural.
- **Script gate format:** label the hook, rising action, second conflict,
  climax and resolution in the script, then wait for approval.

## Signature visual style: minimalist 2D (NOT 3D)

- **Mix (a guideline, not a quota):**
  - about 50% visual metaphors and transformations: loops, mirrors, barriers,
    pathways, shapes that change meaning
  - about 30% minimalist faceless 2D silhouettes
  - about 20% everyday objects: phone, door, clock, mirror, chair, keys
- **Palette:**
  - deep charcoal or midnight-navy backgrounds
  - warm ivory for illustration and type
  - muted gold for discoveries and transformations
  - soft teal as an occasional accent
- **Design:**
  - plenty of negative space
  - clean vectors and elegant typography
  - subtle grain, soft glows and restrained gradients
  - nothing decorative
- **The key rule:** don't illustrate the narration; reveal the mechanism.
  Every animation needs a reason to exist. Examples:
  - "Your mind keeps repeating familiar patterns." → a figure on a circular
    path that quietly curves back every time it tries to leave.
  - "Your self-image can reject evidence that contradicts it." → a mirror
    rejecting gold fragments until its reflection begins to change.
- **Motion:**
  - smooth easing, masking, shape morphing, match cuts, visual repetition,
    meaningful pauses and satisfying reveals
  - one metaphor that evolves, not many disconnected scenes
  - a meaningful development every few seconds, never frantic
  - cinematic pacing, not complicated camera moves
- **Structure:** HOOK (contradiction or mystery) → TENSION (the hidden problem
  as a metaphor) → REVELATION (the real mechanism) → PRACTICAL VALUE (one
  action) → ENDING (resolve the opening metaphor).
- **Avoid:**
  - 3D characters, realistic rooms or complex environments
  - slide-like presentations
  - brain icons, neurons and decorative particles
  - static art with only zooms and pans
  - excessive on-screen text
  - several unrelated metaphors in one video
  - childish cartoons
  - overcomplicated visuals
  - fake science or quantum claims

## Production

- **Tools:** Remotion (React) with SVG and vector animation. Base new projects
  on the existing ones (`old-life/` and `double-slit/` have the current
  pipeline), but use 2D vector scenes, not Three.js rooms.
- **Narration:**
  - Kokoro-82M with the `af_heart` voice, via `scripts/generate_voiceover.py`
    (setup steps in `double-slit/README.md`)
  - word timings from pocketsphinx forced alignment drive the captions
- **Captions:** large and word-synced, kept inside the Instagram safe area:
  nothing important above about 230 px, a bottom margin of about 500 px, and
  clear of the right-hand buttons.
- **Sound:** subtle original sound design and restrained music. The voice
  stays clearly on top, and the master is at −14 LUFS.
- **Delivery:**
  - deliver the MP4 plus editable project files
  - keep the committed MP4 under 100 MB (8 Mbps H.264 is plenty for Instagram)
  - never overwrite earlier videos; each reel gets its own folder

## Quality checks before delivery

1. Are the first 3 seconds visually intriguing?
2. Can the viewer understand the central metaphor with the sound off?
3. Does the animation reveal something rather than decorate the narration?
4. Is the message easy to follow?
5. Does the viewer get useful value at the end?
6. Does the final visual resolve the opening idea?

Also check the rendered file itself:

- narration coverage, using speech recognition on the final mix
- caption sync
- loudness
- blank or clipped frames, from frames sampled across the whole video
