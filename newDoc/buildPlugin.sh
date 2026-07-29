#! /bin/bash
err(){
  echo "ERROR: $*"
  exit 1
}
cd `dirname $0`|| err "unable to cd to $0"
#we are in the dir of the script...
TOOL="../tools/zipTool.py"
[ ! -x "$TOOL" ] && err "$TOOL not found"
base="."
config="$base/plugin.json"
setVersion=1
if [ "$1" = "-n" ] ; then
    setVersion=0
    shift
fi
if [ "$setVersion" != "0" ] ; then
    tmp="__plugin.json"
    if [ "$AVNAV_VERSION" = "" ] ; then
      AVNAV_VERSION=`date '+%Y%m%d'`
      export AVNAV_VERSION
    fi
    echo building version $AVNAV_VERSION
    rm -f "$tmp"
    jq ".version=\"$AVNAV_VERSION\"" < "$config" > "$tmp" || exit 1
    if [ ! -f "$tmp" ] ; then
        echo "tmp file $tmp not created"
        exit 1
    fi
    rm -f "$config"
    mv "$tmp" "$config"
else
    AVNAV_VERSION=`jq -r '.version' < "$config"`
    export AVNAV_VERSION
fi
name="documentation-$AVNAV_VERSION.zip"
echo "creating $name"
./build.sh -d -n -b build || err "build error"
$TOOL -p documentation -x converted "$name" site plugin.json plugin.css menu_book.svg



