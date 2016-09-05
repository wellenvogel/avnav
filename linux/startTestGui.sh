#! /bin/sh
pdir=`dirname $0`
pdir=`readlink -f $pdir`
PROG=$pdir/avnav_gui.py
CFG=avnav_server.xml
RUNDIR=$pdir/../data_linux
rm -f $RUNDIR/$CFG
cp $pdir/$CFG $RUNDIR
vdir="release"
if [ "$1" = "-d" ] ; then
  vdir="debug"
fi
$PROG -b $RUNDIR -u viewer=$pdir/../viewer/build/$vdir

