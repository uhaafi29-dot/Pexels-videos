// Story beats in seconds, anchored to words in the narration. Shared by the
// picture (film.tsx) and the sound design (scripts/generate-ambient.ts).
import {lineAt, wordAt} from './timeline';

export const A = {
  reveal: 1.6, // the waiting outline appears
  home: wordAt('hook', 15), // "Then you get home"
  waiting: wordAt('hook', 20), // "the old you is waiting"
  tryHarder: lineAt('rising'),
  works: wordAt('rising', 3),
  night: wordAt('rising', 9), // "Then one night"
  scrolling: wordAt('rising', 13),
  willpower: lineAt('conflict'),
  strong: wordAt('conflict', 5),
  permission: wordAt('conflict', 9),
  cues: wordAt('conflict', 12), // "Its cues can set it off"
  intend: wordAt('conflict', 19), // "whatever you intend"
  study: lineAt('study'),
  university: wordAt('study', 9),
  fellApart: wordAt('study', 13),
  except: wordAt('study', 15),
  term: lineAt('term'),
  newCues: wordAt('term', 5),
  action: lineAt('action'),
  charge: wordAt('action', 5),
  outWill: lineAt('agency'),
  choose: wordAt('agency', 6), // "But you can choose where it lives"
  cta: lineAt('cta'),
};

