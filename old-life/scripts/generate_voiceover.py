"""Generate the narration with Kokoro-82M (Apache-2.0) and word timings.

Writes one WAV per narration line to public/voiceover/ and the word-level
timestamps (from pocketsphinx forced alignment) to src/voiceover.json, which
drives the subtitles and scene timing. See README "Narration" for setup.

usage: python generate_voiceover.py --model kokoro-q8.onnx --voices DIR
"""

import argparse
import json
import os
import re
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
from pocketsphinx import Decoder

ROOT = Path(__file__).resolve().parent.parent
VOICE = "af_heart"  # warm, natural American English female voice
SPEED = 1.04  # a touch brisker so the reel lands inside 65 s with natural pauses

# key -> text. Keys match the narration entries in src/timeline.ts.
LINES = {
    "l01": "Have you noticed how changing your life can feel easier when you're somewhere new?",
    "l02": "On vacation, you wake up differently. You think differently. Sometimes, you even behave differently.",
    "l03": "Then you return home... and somehow, the old version of you returns too.",
    "l04": "Here's why that's fascinating.",
    "l05": "Your habits aren't stored in willpower alone.",
    "l06": "They're strongly connected to your environment.",
    "l07": "The same room. The same time. The same cues.",
    "l08": "Over time, familiar surroundings can trigger familiar behaviors before you've consciously decided what to do.",
    "l09": "Psychologists study something called the habit discontinuity effect.",
    "l10": "When your environment changes, old cues can lose some of their power.",
    "l11": "And that creates an opportunity to establish new routines.",
    "l12": "So here's something to try.",
    "l13": "Choose one habit you've struggled to change.",
    "l14": "Instead of promising yourself more discipline, change one cue that triggers it.",
    "l15": "Move your phone away from your bed. Change where you work. Rearrange your morning routine.",
    "l16": "Sometimes, becoming someone new starts with making your old routine harder to repeat.",
}


def align(audio: np.ndarray, sr: int, text: str) -> tuple[list[dict], str]:
    """Return word timings (seconds) and a free recognition pass as a check."""
    import scipy.signal  # noqa: PLC0415 – only needed here

    pcm = scipy.signal.resample_poly(audio, 2, 3) if sr == 24000 else audio
    raw = (np.clip(pcm, -1, 1) * 32767).astype(np.int16).tobytes()

    words = re.sub(r"[^a-z' ]", " ", text.lower()).split()
    dec = Decoder(samprate=16000, loglevel="FATAL")
    dec.set_align_text(" ".join(words))
    dec.start_utt()
    dec.process_raw(raw, full_utt=True)
    dec.end_utt()
    timed = []
    for seg in dec.seg():
        if seg.word in ("<sil>", "<s>", "</s>"):
            continue
        timed.append({"start": seg.start_frame / 100, "end": (seg.end_frame + 1) / 100})

    free = Decoder(samprate=16000, loglevel="FATAL")
    free.start_utt()
    free.process_raw(raw, full_utt=True)
    free.end_utt()
    heard = free.hyp().hypstr if free.hyp() else ""

    # Attach the original (punctuated, capitalised) words for display; a
    # hyphenated word ("wave-like") spans several aligned tokens.
    out, i = [], 0
    for w in text.split():
        n = len(re.sub(r"[^a-z' ]", " ", w.lower()).split())
        out.append({"word": w, "start": timed[i]["start"], "end": timed[i + n - 1]["end"]})
        i += n
    assert i == len(timed), (text, timed)
    return out, heard


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="Kokoro-82M ONNX model")
    ap.add_argument("--voices", required=True, help="directory with <voice>.bin style vectors")
    args = ap.parse_args()

    style = np.fromfile(os.path.join(args.voices, f"{VOICE}.bin"), dtype=np.float32).reshape(510, 1, 256)
    voices_npz = ROOT / "out" / "voices.npz"
    voices_npz.parent.mkdir(exist_ok=True)
    np.savez(voices_npz, **{VOICE: style})
    kokoro = Kokoro(args.model, str(voices_npz))

    out_dir = ROOT / "public" / "voiceover"
    out_dir.mkdir(parents=True, exist_ok=True)
    result = {}
    for key, text in LINES.items():
        audio, sr = kokoro.create(text, voice=VOICE, speed=SPEED)
        sf.write(out_dir / f"{key}.wav", audio, sr)
        words, heard = align(audio, sr, text)
        result[key] = {"text": text, "file": f"voiceover/{key}.wav", "duration": round(len(audio) / sr, 3), "words": words}
        print(f"{key:11s} {len(audio) / sr:5.2f}s  heard: {heard!r}")

    (ROOT / "src" / "voiceover.json").write_text(json.dumps(result, indent=2) + "\n")
    print("wrote src/voiceover.json")


if __name__ == "__main__":
    main()
