#! /bin/sh
pdir=`dirname $0`
pdir=`readlink -f $pdir`
PROG=$pdir/avnav
CFG=avnav_server.xml
RUNDIR=$pdir/../data_linux
if [ "$HOME" != "" ]; then
  RUNDIR=$HOME/avnav
fi
rm -f $RUNDIR/$CFG
vdir="release"
gui=0
while getopts dg opt; do
case $opt in
  d)
    vdir=debug
    ;;
  g)
    gui=1
    ;;
  \?)
    echo "invalid option $opt"
    exit 1
esac
done
shift $((OPTIND-1))  

if [ $gui = 0 ]; then
  exec $PROG -e -b $RUNDIR -c $HOME/AvNavCharts/out -v $pdir/../viewer/build/$vdir -t $pdir/avnav_server.xml -a $pdir/..
else
  exec $PROG -e -b $RUNDIR -g -v $pdir/../viewer/build/$vdir -t $pdir/avnav_server.xml -a $pdir/..
fi
