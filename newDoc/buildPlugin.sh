#! /bin/bash
err(){
  echo "ERROR: $*"
  exit 1
}
cd `dirname $0`|| err "unable to cd to $0"
#we are in the dir of the script...
base="documentation" 
config="plugin-in.json"
tconfig="plugin.json"
target="../build"
ziptool="../tools/zipTool.py"
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
./build.sh -d -n -b build || err "build error"
"$ziptool" -p "$base" -x converted "$name" site plugin.json plugin.css menu_book.svg



