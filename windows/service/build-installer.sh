#! /bin/sh
cd `dirname $0` || exit 1
docker run  --rm   -v `pwd`:/build   --user `id -u`:`id -g` binfalse/nsis install.nsi