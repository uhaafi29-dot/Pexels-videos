#!/usr/bin/env python3
"""
Search Pexels for videos and download the top results.

Usage:
    export PEXELS_API_KEY="your-api-key-here"
    python3 scripts/download_pexels_videos.py --query sea --count 10

Or pass the key directly:
    python3 scripts/download_pexels_videos.py --query sea --count 10 --api-key YOUR_KEY

Get a free API key at https://www.pexels.com/api/
"""

import argparse
import os
import re
import sys
from pathlib import Path

import requests

SEARCH_URL = "https://api.pexels.com/videos/search"


def parse_args():
    parser = argparse.ArgumentParser(description="Download top Pexels video search results.")
    parser.add_argument("--query", default="sea", help="Search term (default: sea)")
    parser.add_argument("--count", type=int, default=10, help="Number of videos to download (default: 10)")
    parser.add_argument(
        "--output-dir",
        default="pexels-videos",
        help="Folder to save downloaded videos into (default: pexels-videos)",
    )
    parser.add_argument(
        "--quality",
        default="hd",
        choices=["hd", "sd", "uhd"],
        help="Preferred video quality/file type from Pexels (default: hd). "
        "Falls back to the highest-resolution file available if the preferred quality isn't present.",
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("PEXELS_API_KEY"),
        help="Pexels API key. Defaults to the PEXELS_API_KEY environment variable.",
    )
    return parser.parse_args()


def slugify(text: str) -> str:
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[\s_-]+", "-", text)


def pick_video_file(video_files, preferred_quality):
    # Prefer an exact quality match, then fall back to the highest resolution available.
    matches = [f for f in video_files if f.get("quality") == preferred_quality]
    candidates = matches if matches else video_files
    return max(candidates, key=lambda f: (f.get("width") or 0) * (f.get("height") or 0))


def download_file(url: str, dest: Path):
    with requests.get(url, stream=True, timeout=60) as resp:
        resp.raise_for_status()
        with open(dest, "wb") as fh:
            for chunk in resp.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    fh.write(chunk)


def main():
    args = parse_args()

    if not args.api_key:
        print(
            "Error: no Pexels API key provided. Set PEXELS_API_KEY or pass --api-key.",
            file=sys.stderr,
        )
        sys.exit(1)

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    headers = {"Authorization": args.api_key}
    params = {"query": args.query, "per_page": min(args.count, 80)}

    print(f"Searching Pexels for '{args.query}' (top {args.count})...")
    resp = requests.get(SEARCH_URL, headers=headers, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    videos = data.get("videos", [])[: args.count]
    if not videos:
        print("No videos found for that query.", file=sys.stderr)
        sys.exit(1)

    for i, video in enumerate(videos, start=1):
        video_id = video["id"]
        video_files = video.get("video_files", [])
        if not video_files:
            print(f"  [{i}] video {video_id}: no downloadable files, skipping")
            continue

        best = pick_video_file(video_files, args.quality)
        ext = best.get("file_type", "video/mp4").split("/")[-1] or "mp4"
        user_name = slugify(video.get("user", {}).get("name", "unknown"))
        filename = f"{i:02d}-{args.query}-{video_id}-{user_name}.{ext}"
        dest = out_dir / filename

        print(f"  [{i}/{len(videos)}] downloading video {video_id} "
              f"({best.get('width')}x{best.get('height')}, {best.get('quality')}) -> {dest}")
        try:
            download_file(best["link"], dest)
        except requests.RequestException as e:
            print(f"    failed: {e}", file=sys.stderr)

    print(f"Done. Videos saved to {out_dir.resolve()}")


if __name__ == "__main__":
    main()
