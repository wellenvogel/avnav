#! /bin/bash
pdir=`dirname $0`
err(){
  echo "ERROR: $*"
  exit 1
}
usage(){
  echo "usage: $0 [-r] [-v version] [-s start_tag_or_commit] [-e end_tag_or_commit] [-i ignore]"
}

fetchData(){
  local outfile="$1"
  local latest="$2"
  local eopt="$3"
  echo "# Changes since $latest" >> $outfile
  echo >> $outfile
  echo "## Handled issues" >> $outfile
  echo >> $outfile
  $pdir/history.sh $eopt $latest >> $outfile
  echo >> $outfile
  echo "## Merged pull requests" >> $outfile
  echo >> $outfile
  $pdir/history.sh $eopt -P $latest >> $outfile
  echo >> $outfile
}
version=`date '+%Y%m%d'`
latest=""
tend=""
mode="both"
ignore=""
while getopts rv:s:e:i: opt
do
   case $opt in
       v) version="$OPTARG";;
       s) latest="$OPTARG";;
       e) tend="$OPTARG";;
       r) mode="release" ;;
       i) ignore="$OPTARG";;
       \?) err "invalid option $opt"
   esac
done
[ "$latest" != "" ] && mode="single"
shift $(($OPTIND - 1))
outfile=`dirname $0`/../build/distributions/changes-$version.md
if [ $mode = "both" -o $mode = "release" ] ; then
  echo fetching latest release
  latest=`$pdir/listTags.sh "release-" 1 "$ignore"`
fi
latest2=""
if [ "$mode" = "both" ] ; then
  echo "fetching latest daily"
  latest2=`$pdir/listTags.sh "daily-" 1 "$ignore"`
  [ "$latest2" = "" ] && echo "WARNING: unable to determine latest daily"
fi
[ "$latest" = "" ] && err "unable to determine latest version"
if [ -f "$outfile" ] ; then
  rm -f "$outfile"
fi
eopt=""
if [ "$tend" != "" ] ; then
  eopt="-e $tend"
fi
if [ "$latest2" != "" ] ; then
  echo "filling $outfile with changes since $latest2"
  fetchData "$outfile" "$latest2" "$eopt"
fi
echo "filling $outfile with changes since $latest"
fetchData "$outfile" "$latest" "$eopt"





