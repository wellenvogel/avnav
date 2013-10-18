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

jqueryImages=`cat <<EOF
animated-overlay.gif
ui-bg_flat_0_aaaaaa_40x100.png
ui-bg_flat_75_ffffff_40x100.png
ui-bg_glass_55_fbf9ee_1x400.png
ui-bg_glass_65_ffffff_1x400.png
ui-bg_glass_75_dadada_1x400.png
ui-bg_glass_75_e6e6e6_1x400.png
ui-bg_glass_95_fef1ec_1x400.png
ui-bg_highlight-soft_75_cccccc_1x100.png
ui-icons_222222_256x240.png
ui-icons_2e83ff_256x240.png
ui-icons_454545_256x240.png
ui-icons_888888_256x240.png
ui-icons_cd0a0a_256x240.png
EOF
`

for d in avnav avnav/program avnav/program/server avnav/program/viewer avnav/program/raspberry avnav/program/convert avnav/program/libraries svn
do
  mkdir -p $TMPDIR/$d || err "unable to create $TMPDIR/$d"
  chown 1000:1000 $TMPDIR/$d
done

wlog "starting download from $baseurl"
( cd $TMPDIR/svn && svn co $baseurl avnav) || err "svn co failed"
find $TMPDIR/svn -type d -name '.svn' -exec rm -rf {} \;
find $TMPDIR/svn  -name '.??*' -exec rm -rf {} \;
TDIR=$TMPDIR/avnav/program/viewer
wlog "writing files for $TDIR"
( cd $TDIR && cp -r -p $TMPDIR/$SVNBASE/viewer/* . ) || err "cp viewer failed"
chown -R 1000:1000 $TDIR || err "chown viewer failed"

TDIR=$TMPDIR/avnav/program/server
wlog "writing files for $TDIR"
for f in avnav_server.py ais.py create_overview.py
do
  ( cd $TDIR && cp -p $TMPDIR/$SVNBASE/server/$f . ) || err "cp $f failed"
  chown 1000:1000 $TDIR/$f || err "chown $f failed"
  chmod a+rx $TDIR/$f || err "chmod $f failed"
done
TDIR=$TMPDIR/avnav/program/convert
wlog "writing files for $TDIR"
for f in read_charts.py
do
  ( cd $TDIR && cp -p $TMPDIR/$SVNBASE/chartconvert/$f . ) || err "cp $f failed"
  chown 1000:1000 $TDIR/$f || err "chown $f failed"
  chmod a+rx $TDIR/$f || err "chmod $f failed"
done
TDIR=$TMPDIR/avnav/program/raspberry
wlog "writing files for $TDIR"
for f in settime settime.c avnav_server.xml avnav check_parts setup.sh check_wlan
do
  ( cd $TDIR && cp -p $TMPDIR/$SVNBASE/raspberry/$f . ) || err "cp $f failed"
  chown 1000:1000 $TDIR/$f || err "chown $f failed"
  chmod a+rx $TDIR/$f || err "chmod $f failed"
done
chown 0:0 $TDIR/settime || err "chown settime failed"
chmod 755 $TDIR/settime || err "chmod settime failed"
chmod u+s $TDIR/settime || err "chmod settime failed"

TDIR=$TMPDIR/avnav/program/libraries
wlog "writing files for $TDIR"
for lib in less/less-1.4.1.min.js OpenLayers-2.12/OpenLayers.js OpenLayers-2.12/theme/default/style.css jquery/jquery-1.9.1.min.js jquery/jquery-ui.js jquery/jquery.ui.touch-punch.min.js jquery/jquery-ui.css jquery/jquery.cookie.js movable-type/geo.js movable-type/latlon.js `echo $jqueryImages | tr ' ' '\012' | sed 's?.*?jquery/images/&?'`
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
(cd $TMPDIR  && tar -cf - --exclude=svn .) | cat > $1 || err "unable to create tar file $1"
zipname=`echo $1 | sed s/\.[^.]*$//`-host.zip
wlog "creating $zipname"
( cd $TMPDIR/svn/avnav && rm -f library && mv ../../avnav/program/libraries library && zip -r --exclude=\*readme-nv.txt --exclude=\*convert_nv.py ../../host.zip * ) || err "unable to create $TMPDIR/host.zip"
rm -f $zipname 2> /dev/null
mv $TMPDIR/host.zip $zipname




	
