#! /bin/bash
pdir=`dirname $0`
pdir=`readlink -f $pdir/..`
docker run --rm -ti -u "`id -u`:`id -g`" -e HOME=/src/test/home39 -w /src -v $pdir:/src python39-avnav:1 ./linux/avnav -a . -v viewer/build/debug

