#! /bin/sh
if [ "$1" = "" -o "$2" = "" ] ; then
  echo "usage: $0 url outname"
fi
ytdl.sh -f "bestvideo[height<=720]+bestaudio/best[height<=720]" -S "ext:mp4:m4a" --write-subs -o "$2.%(ext)s" "$1"
 
