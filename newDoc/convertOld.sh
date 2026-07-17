#! /bin/bash
#set -x
pdir=`dirname $0`
pdir=`readlink -f $pdir`
OLDSRC="$pdir/../docs"
NEWSRC="$pdir/docs/converted"
NEWIMG="$pdir/docs/converted/img"
SCRIPT="$pdir/markdownify/convert.py"
BUTTONJSON="$pdir/docs/generated/buttons.json"
usage(){
    echo "usage: $0 relPathOfOldFile"
}
err(){
    echo "ERROR: $*"
    exit 1
}
if [ "$1" = "" ] ; then
  usage
  exit 1
fi
rel=`realpath -s --relative-to=$OLDSRC $1`
echo "relpath=$rel"
[ ! -x "$SCRIPT" ] && err "$SCRIPT not found/not executable"
[ ! -e "$BUTTONJSON" ] && err "$BUTTONJSON not found"
src="$OLDSRC/$rel"
target="$NEWSRC/$rel"
[ ! -e "$src" ] && err "$src not found"
echo "converting $src to $target"
"$SCRIPT" -i "$NEWIMG" -c -b "$BUTTONJSON" "$src" "$target"
