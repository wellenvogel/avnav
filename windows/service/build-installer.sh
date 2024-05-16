#! /bin/sh
pdir=`dirname $0`
pdir=`readlink -f $pdir`
docker run  --rm   -v $pdir/..:/build   --user `id -u`:`id -g` binfalse/nsis $* service/install.nsi 