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
SPEED = 1.04  # natural pace for this voice
# lines that carry the science or the key insight are read a little slower
LINE_SPEED = {"study": 0.98, "term": 0.96, "agency": 0.92, "cta": 1.0}

# key -> text. Keys match the narration entries in src/timeline.ts.
LINES = {
    "hook": "On vacation, you're a different person. You wake up early. You barely touch your phone. Then you get home, and the old you is waiting.",
    "rising": "You try harder. It works, for a few days. Then one night, you're scrolling in bed without deciding to.",
    "conflict": "It feels like weak willpower. But a strong habit doesn't wait for permission. Its cues can set it off, whatever you intend.",
    "study": "When researchers followed students who moved to a new university, their old habits fell apart, except where parts of the old setting stayed the same.",
    "term": "Psychologists call this habit discontinuity. New cues open a window to choose again.",
    "action": "So tonight, try an experiment: charge your phone outside the bedroom.",
    "agency": "You can't always out-will a cue. But you can choose where it lives.",
    "cta": "Follow The Psychology of Becoming.",
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
        audio, sr = kokoro.create(text, voice=VOICE, speed=LINE_SPEED.get(key, SPEED))
        sf.write(out_dir / f"{key}.wav", audio, sr)
        words, heard = align(audio, sr, text)
        result[key] = {"text": text, "file": f"voiceover/{key}.wav", "duration": round(len(audio) / sr, 3), "words": words}
        print(f"{key:11s} {len(audio) / sr:5.2f}s  heard: {heard!r}")

    (ROOT / "src" / "voiceover.json").write_text(json.dumps(result, indent=2) + "\n")
    print("wrote src/voiceover.json")


if __name__ == "__main__":
    main()
