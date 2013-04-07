#! /bin/sh
# vim: ts=2 sw=2 et
# Author: Andreas Vogel <andreas@wellenvogel.net>

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

basedir=/
err(){
  echo "ERROR: $*"
  exit 1
}
i=`id -u`
[ "$i" != "0" ] && err "this must be run as root"
[ "$1" = "" ] && err "usage: $0 part|nopart|dist"
scriptdir=`dirname $0`
scriptdir=`readlink -f $scriptdir`

if [ "$1" != "dist" ] ; then
  echo "trying to stop avnav if it is running"
  service avnav stop
  pdir=$scriptdir
else
  [ "$2" = "" ] && err "missing mandatory parameter basedir"
  basedir=$2
  pdir=/home/pi/avnav/raspberry
fi


for serv in check_parts avnav
do
  if [ ! -h $basedir/etc/init.d/$serv ] ; then
    rm -f $basedir/etc/init.d/$serv
    echo "creating $basedir/etc/init.d/$serv"
    ln -s $pdir/$serv $basedir/etc/init.d/$serv
    chmod 755 $scriptdir/$serv
  else
    echo "/etc/init.d/$serv is already linked"
  fi
	
done

chown root:root $scriptdir/settime
chmod u+s $scriptdir/settime 

if [ "$1" = "part" ] ; then
  echo "starting partitioning check"
  /etc/init.d/check_parts worker
  exit 0
fi
if [ "$1" = "nopart" ] ; then
  echo "enabling service avnav"
  update-rc.d avnav enable
  service avnav start
  exit 0
fi
#dist only
echo "creating link for check_parts"
ln -s /etc/init.d/check_parts $basedir/etc/rc2.d/S99check_parts




