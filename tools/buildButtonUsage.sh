#! /bin/sh
pdir=`dirname $0`
wd=$pdir/../docs
$pdir/buttonUsage.py -f pandoc > $wd/buttonUsage.md || exit 1
( cd $wd && pandoc -o buttonUsage.odt --embed-resources=true buttonUsage.md ) || exit 1
$pdir/buttonUsage.py -f sparse > $wd/buttonUsage.md



