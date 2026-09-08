# Pexels Videos Downloader

A small script to search [Pexels](https://www.pexels.com/) for videos and
download the top results to a local folder.

## Setup

```bash
pip install -r requirements.txt
```

Get a free API key at https://www.pexels.com/api/, then set it as an
environment variable:

```bash
export PEXELS_API_KEY="your-api-key-here"
```

## Usage

```bash
python3 scripts/download_pexels_videos.py --query sea --count 10
```

This downloads the top 10 "sea" video results into a `pexels-videos/` folder
in the current directory.

### Options

| Flag | Default | Description |
| --- | --- | --- |
| `--query` | `sea` | Search term |
| `--count` | `10` | Number of videos to download |
| `--output-dir` | `pexels-videos` | Destination folder |
| `--quality` | `hd` | Preferred quality (`sd`, `hd`, `uhd`); falls back to the highest resolution available if not found |
| `--api-key` | `$PEXELS_API_KEY` | API key (or use the env var instead) |

Example, downloading 5 UHD "ocean" videos into a custom folder:

```bash
python3 scripts/download_pexels_videos.py --query ocean --count 5 --quality uhd --output-dir my-videos
```

## Notes

- Downloaded video files are not committed to this repo (see `.gitignore`) —
  video files are large and Pexels licensing means each user should fetch
  their own copies with their own API key.
