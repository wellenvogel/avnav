#! /bin/bash
pdir=`dirname $0`
err(){
  echo "ERROR: $*"
  exit 1
}
usage(){
  echo "usage: $0 [-r] [-v version] [-s start_tag_or_commit] [-e end_tag_or_commit]"
}
version=`date '+%Y%m%d'`
latest=""
tend=""
prfx=""
while getopts rv:s:e: opt
do
   case $opt in
       v) version="$OPTARG";;
       s) latest="$OPTARG";;
       e) tend="$OPTARG";;
       r) prfx="release-" ;;
       \?) err "invalid option $opt"
   esac
done
shift $(($OPTIND - 1))
outfile=`dirname $0`/../build/distributions/changes-$version.md
if [ "$latest" = "" ] ; then
  echo "fetching latest"
  if [ "$prfx" != "" ] ; then
    latest=`$pdir/listTags.sh "$prfx"`
  else 
    latest="`$pdir/getLatest.sh $prfx`"
  fi
fi
[ "$latest" = "" ] && err "unable to determine latest version"
if [ -f "$outfile" ] ; then
  rm -f "$outfile"
fi
eopt=""
if [ "$tend" != "" ] ; then
  eopt="-e $tend"
fi
echo "creating $outfile with changes since $latest"
echo "# Changes since $latest" >> $outfile
echo >> $outfile
echo "## Handled issues" >> $outfile
echo >> $outfile
$pdir/history.sh $eopt $latest >> $outfile
echo >> $outfile
echo "## Merged pull requests" >> $outfile
echo >> $outfile
$pdir/history.sh $eopt -P $latest >> $outfile


