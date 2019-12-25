#! /bin/sh
PDIR=`dirname $0`
while [ 1 ] ; do
  inotifywait --exclude '(\.git|_build/|avnav.css|swp$)' -e modify -e delete -e create -e delete -r $PDIR
  rm -rf $PDIR/../build
  sphinx-build $PDIR $PDIR/../build
done
