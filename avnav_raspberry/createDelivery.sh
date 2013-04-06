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
baseurl="svn://10.222.10.12/src1/avnav"
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
      baseurl="$OPTARG"
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

[ "$1" = "" ] && err "usage: $0 [-b baseurl] tarfile"

trap cleanup 0 1 2 3 4 5 6 7 8 15
mkdir -p $TMPDIR || err "unable to create $TMPDIR"
chown 1000:1000 $TMPDIR || err "unable to chown $TMPDIR"

for d in avnav avnav/server avnav/viewer avnav/raspberry svn
do
  mkdir -p $TMPDIR/$d || err "unable to create $TMPDIR/$d"
  chown 1000:1000 $TMPDIR/$d
done

wlog "starting download from $baseurl"
( cd $TMPDIR/svn && svn co $baseurl avnav) || err "svn co failed"
( cd $TMPDIR/avnav/viewer && cp -r -p $TMPDIR/$SVNBASE/avnav_viewer/* . ) || err "cp viewer failed"
chown -R 1000:1000 $TMPDIR/avnav/viewer || err "chown viewer failed"
for f in avnav_server.py
do
  ( cd $TMPDIR/avnav/server && cp -p $TMPDIR/$SVNBASE/avnav_server/$f . ) || err "cp $f failed"
  chown 1000:1000 $TMPDIR/avnav/server/$f || err "chown $f failed"
  chmod a+rx $TMPDIR/avnav/server/$f || err "chmod $f failed"
done
for f in settime settime.c avnav_server.xml avnav check_parts setup.sh
do
  ( cd $TMPDIR/avnav/raspberry && cp -p $TMPDIR/$SVNBASE/avnav_raspberry/$f . ) || err "cp $f failed"
  chown 1000:1000 $TMPDIR/avnav/raspberry/$f || err "chown $f failed"
  chmod a+rx $TMPDIR/avnav/raspberry/$f || err "chmod $f failed"
done
chown 0:0 $TMPDIR/avnav/raspberry/settime || err "chown settime failed"
chmod 755 $TMPDIR/avnav/raspberry/settime || err "chmod settime failed"
chmod u+s $TMPDIR/avnav/raspberry/settime || err "chmod settime failed"

wlog "creating tar file $1"
(cd $TMPDIR  && rm -rf svn && tar -cf - .) | cat > $1 || err "unable to create tar file $1"





	
