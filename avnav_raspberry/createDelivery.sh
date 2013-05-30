#! /bin/sh
# vim: ts=2 et sw=2
###############################################################################
# Copyright (c) 2012,2013 Andreas Vogel andreas@wellenvogel.net
#
#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
###############################################################################

# create our tarball
host=10.222.10.12
TMPDIR=/tmp/ctb$$
SVNBASE=svn/avnav
keepTemp=0
err(){
  echo "ERROR: $*"
  exit 1
}


wlog(){
  echo "INFO: $*"
}

cleanup(){
  cd 
  [ "$keepTemp" != "1" ] && rm -rf $TMPDIR
}


while getopts b:k opt ; do
  case $opt in
    b)
      host="$OPTARG"
      ;;
    k)
      keepTemp=1
      ;;
    *)
      err "invalid option $opt"
      ;;
  esac
done

shift `expr $OPTIND - 1`

[ "$1" = "" ] && err "usage: $0 [-b host] tarfile"

baseurl=svn://$host/src1/avnav
libbase=http://$host/libraries

trap cleanup 0 1 2 3 4 5 6 7 8 15
mkdir -p $TMPDIR || err "unable to create $TMPDIR"
chown 1000:1000 $TMPDIR || err "unable to chown $TMPDIR"

for d in avnav avnav/program avnav/program/server avnav/program/viewer avnav/program/raspberry avnav/program/libraries svn
do
  mkdir -p $TMPDIR/$d || err "unable to create $TMPDIR/$d"
  chown 1000:1000 $TMPDIR/$d
done

wlog "starting download from $baseurl"
( cd $TMPDIR/svn && svn co $baseurl avnav) || err "svn co failed"
find $TMPDIR/svn -type d -name '.svn' -exec rm -rf {} \;
TDIR=$TMPDIR/avnav/program/viewer
wlog "writing files for $TDIR"
( cd $TDIR && cp -r -p $TMPDIR/$SVNBASE/avnav_viewer/* . ) || err "cp viewer failed"
chown -R 1000:1000 $TDIR || err "chown viewer failed"

TDIR=$TMPDIR/avnav/program/server
wlog "writing files for $TDIR"
for f in avnav_server.py ais.py
do
  ( cd $TDIR && cp -p $TMPDIR/$SVNBASE/avnav_server/$f . ) || err "cp $f failed"
  chown 1000:1000 $TDIR/$f || err "chown $f failed"
  chmod a+rx $TDIR/$f || err "chmod $f failed"
done
TDIR=$TMPDIR/avnav/program/raspberry
wlog "writing files for $TDIR"
for f in settime settime.c avnav_server.xml avnav check_parts setup.sh
do
  ( cd $TDIR && cp -p $TMPDIR/$SVNBASE/avnav_raspberry/$f . ) || err "cp $f failed"
  chown 1000:1000 $TDIR/$f || err "chown $f failed"
  chmod a+rx $TDIR/$f || err "chmod $f failed"
done
chown 0:0 $TDIR/settime || err "chown settime failed"
chmod 755 $TDIR/settime || err "chmod settime failed"
chmod u+s $TDIR/settime || err "chmod settime failed"

TDIR=$TMPDIR/avnav/program/libraries
wlog "writing files for $TDIR"
for lib in OpenLayers-2.12/OpenLayers.js OpenLayers-2.12/theme/default/style.css jquery/jquery-1.9.1.min.js jquery/jquery-ui.js jquery/jquery.nicescroll.min.js jquery/jquery.ui.touch-punch.min.js jquery/jquery-ui.css jquery/jquery.cookie.js
do
  tdir=`dirname $TDIR/$lib`
  if [ ! -d $tdir ] ; then
    mkdir -p $tdir || err "unable to create $tdir"
  fi
  ( cd $TDIR && wget -O $lib $libbase/$lib  ) || err "download $libbase/$lib failed"
done
chown -R 1000:1000 $TDIR
chmod -R a+r $TDIR

mv $TMPDIR/avnav/program/raspberry/setup.sh $TMPDIR/avnav

wlog "creating tar file $1"
(cd $TMPDIR  && rm -rf svn && tar -cf - .) | cat > $1 || err "unable to create tar file $1"





	
