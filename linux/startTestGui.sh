#! /bin/sh
pdir=`dirname $0`
pdir=`readlink -f $pdir`
PROG=$pdir/avnav_gui.py
CFG=avnav_server.xml
RUNDIR=$pdir/../data_linux
rm -f $RUNDIR/$CFG
cp $pdir/$CFG $RUNDIR
$PROG -b $RUNDIR

