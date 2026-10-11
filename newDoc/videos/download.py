#! /usr/bin/env python3
"""Download videos listed in ../docs/videos.yml.

Usage: download.py [-f] [-l] [name ...]
Without names all entries having an "intern" file are downloaded.
Existing videos are skipped unless -f is given.
"""
import argparse
import os
import subprocess
import sys

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_YAML = os.path.join(HERE, "..", "docs", "videos.yml")
FORMAT = "bestvideo[height<=720]+bestaudio/best[height<=720]"


def main():
    parser = argparse.ArgumentParser(description="download videos from videos.yml")
    parser.add_argument("names", nargs="*", help="video names (keys in videos.yml), default: all")
    parser.add_argument("-f", "--force", action="store_true", help="overwrite existing videos")
    parser.add_argument("-y", "--yaml", default=DEFAULT_YAML, help="videos yaml file")
    parser.add_argument("-c", "--command", default="ytdl.sh", help="download command (default: ytdl.sh)")
    args = parser.parse_args()

    with open(args.yaml, "r", encoding="utf-8") as fh:
        videos = yaml.safe_load(fh)

    names = args.names or [k for k, v in videos.items() if v.get("intern") and v.get("youtube")]
    unknown = [n for n in names if n not in videos]
    if unknown:
        print("unknown videos: %s (available: %s)" % (", ".join(unknown), ", ".join(videos)), file=sys.stderr)
        return 1

    errors = 0
    for name in names:
        entry = videos[name]
        youtube = entry.get("youtube")
        intern = entry.get("intern")
        if not youtube or not intern:
            print("%s: no youtube id or intern file, skipping" % name)
            continue
        outname = os.path.splitext(intern)[0]
        target = outname + ".mp4"
        if os.path.exists(os.path.join(HERE, target)) and not args.force:
            print("%s: %s exists, skipping (use -f to overwrite)" % (name, target))
            continue
        url = "https://www.youtube.com/watch?v=%s" % youtube
        cmd = [args.command, "-f", FORMAT, "-S", "ext:mp4:m4a", "--write-subs",
               "--merge-output-format", "mp4",
               "-o", "%s.%%(ext)s" % outname]
        if args.force:
            cmd.append("--force-overwrites")
        cmd.append(url)
        print("%s: %s" % (name, " ".join(cmd)))
        try:
            rc = subprocess.call(cmd, cwd=HERE)
        except OSError as e:
            print("%s: cannot run %s: %s" % (name, args.command, e), file=sys.stderr)
            rc = 1
        if rc != 0:
            print("%s: download failed (%d)" % (name, rc), file=sys.stderr)
            errors += 1
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
