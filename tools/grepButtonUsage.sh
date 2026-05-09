#! /bin/sh
mode=0
if [ "$1" = "-m" ] ; then
  mode=1
  shift
fi
doGrep(){
  local d=$1
  shift
  grep  -rHn  --exclude-dir='build' --exclude-dir='.gradle' --exclude-dir='.idea' $* '[^[]ButtonDefs\.' $d \
   | awk -F: '{gsub(/.*ButtonDefs/,"ButtonDefs",$3); gsub(/[^.a-zA-Z0-9].*/,"",$3); print $1":"$2":"$3}'
}
pdir=`dirname $0`
if [ $mode = 0 ] ; then
  cd $pdir/.. | exit 1
  doGrep viewer $*
else
   cd $pdir/../docs || exit 1
   echo "| Datei | Zeile | Inhalt |" 
   echo "| --- | --- | --- |"
   doGrep ../viewer/  \
        | awk -F: '{print "| ["$1"]("$1"#L"$2" ) | "$2" | "substr($0, index($0,$3))" |"}'
fi
