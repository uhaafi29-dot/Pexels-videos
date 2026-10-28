// Writes public/captions.srt from the narration timings in src/timeline.ts.
// Run: npm run captions
import {writeFileSync} from 'node:fs';
import {CAPTIONS, FPS} from '../src/timeline.ts';

const ts = (frames: number) => {
  const ms = Math.round((frames / FPS) * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

const srt = CAPTIONS.map((c, i) => `${i + 1}\n${ts(c.words[0].from)} --> ${ts(c.to)}\n${c.text}\n`).join('\n');
writeFileSync(new URL('../public/captions.srt', import.meta.url), srt);
console.log(srt);
