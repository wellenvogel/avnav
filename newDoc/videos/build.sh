#! /bin/bash
pdir=`dirname $0`
cd $pdir || exit 1
base="docvideos" #must match the entry in plugin.json
config="plugin-in.json"
tconfig="plugin.json"
target="../../build"
ziptool="../../tools/zipTool.py"
if [ ! -x "$ziptool" ] ; then
    echo "zip tool $ziptool not found"
    exit 1
fi
if [ "$1" = "" ] ; then
    version=`date '+%Y%m%d'`
else
    version="$1"
fi
echo building version $version
rm -f $tconfig
jq ".version=\"$version\"" < "$config" > "$tconfig" || exit 1
if [ ! -f "$tconfig" ] ; then
    echo "tmp file $tconfig not created"
    exit 1
fi
name="$target/$base-$version.zip"
echo "creating $name"
"$ziptool" -p "$base" -x "ytdl.sh" -x "build.sh" -x "plugin-in.json" "$name" *
