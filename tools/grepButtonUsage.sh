#! /bin/sh
mode=0
if [ "$1" = "-m" ] ; then
  mode=1
  shift
fi
pdir=`dirname $0`
if [ $mode = 0 ] ; then
  cd $pdir/.. | exit 1
  grep  -rHn -C 3  --exclude-dir='build' --exclude-dir='.gradle' --exclude-dir='.idea' $* '[^[]ButtonDefs\.' viewer/
else
   cd $pdir/../docs || exit 1
   echo "| Datei | Zeile | Inhalt |" 
   echo "| --- | --- | --- |"
   grep  -rHn  --exclude-dir='build' --exclude-dir='.gradle' --exclude-dir='.idea' $* '[^[]ButtonDefs\.' ../viewer/  \
        | awk -F: '{print "| ["$1"]("$1"#L"$2" ) | "$2" | "substr($0, index($0,$3))" |"}'
fi
