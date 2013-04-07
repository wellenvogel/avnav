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
updateurl="http://www.wellenvogel.de/segeln/technik/avnav/avnav-current.tar"
basedir=/
dist=0
keepStopped=0
err(){
  echo "ERROR: $*"
  exit 1
}

restoreSuid(){
  chown root:root $basedir/$pdir/program/raspberry/settime
  chmod u+s $basedir/$pdir/program/raspberry/settime 
}
i=`id -u`
[ "$i" != "0" ] && err "this must be run as root"

scriptdir=`dirname $0`
scriptdir=`readlink -f $scriptdir`

while getopts sd: opt ; do
  case $opt in
    d)
    dist=1
    basedir=$OPTARG
    ;;
    s)
    keepStopped=1
    ;;
    *)
    err "invalid option $opt"
    ;;
  esac
done

shift `expr $OPTIND - 1`
[ "$1" = "" ] && err "usage: $0 [-d ] [-s] part|nopart|update"
[ $dist = 1 -a "$1" = "part" ] && err "mode part not with -d"
[ $keepStopped = 1 -a "$1" = "part" ] && err "-s not possible with mode part"

if [ $dist = 0 ] ; then
  echo "trying to stop avnav if it is running"
  service avnav stop
  pdir=$scriptdir
else
  #dir within image...
  pdir=/home/pi/avnav
fi



for serv in check_parts avnav
do
  if [ ! -h $basedir/etc/init.d/$serv ] ; then
    rm -f $basedir/etc/init.d/$serv
    echo "creating $basedir/etc/init.d/$serv"
    ln -s $pdir/program/$serv $basedir/etc/init.d/$serv
    chmod 755 $scriptdir/$serv
  else
    echo "/etc/init.d/$serv is already linked"
  fi
	
done



if [ "$1" = "part" ] ; then
  restoreSuid
  echo "starting partitioning check"
  /etc/init.d/check_parts worker
  exit 0
fi
if [ "$1" = "nopart" -a $dist = 0 ] ; then
  restoreSuid
  echo "enabling service avnav"
  update-rc.d avnav enable
  [ $keepStopped = 0 ] && service avnav start
  exit 0
fi
if [ "$1" = "update" ] ; then
  savename=`date +"%Y%m%d%H%M"`
  savename="$basedir/$pdir/program-$savename"
  if [ "$2" = "" ] ; then
    upd=$updateurl
  else
    upd=$2
  fi
  x=`echo "$up" | grep '^http'`
  doDelete=0
  if [ "$x" != "" ] ; then
    echo "download update from $upd"
    tmpfile=/tmp/avnav-delivery.tar
    rm -f $tmpfile
    wget -O $tmpfile $upd || err "downloading update failed"
    [ -s $tmpfile ] || err "file $tmpfile does not exist after download"
    upd=$tmpfile
    doDelete=1
  else
    [ -f $upd ] || err "update $upd does not exist"
  fi
  if [ -e $basedir/$pdir/program ] ; then
  	echo "saving current version to $savename"
  	[ -d $savename ] && err "$savename already exists, wait one minute and retry"
  	mv $basedir/$pdir/program $savename || err "unable to rename $basedir/$pdir/program to $savename"
  fi
  cat $upd | ( cd $basedir/$pdir/.. && tar -xvf - ) || err "error while unpacking $updateurl, you must restore $savename..."
  if [ $doDelete = 1 ] ; then
    echo "removing $upd"
    rm -f $upd
  fi
  restoreSuid
fi
#dist only
if [ $dist = 0 ] ; then
  if [ $keepStopped = 0 ] ; then
    echo "starting avnav" 
    service avnav start 
  fi
  exit 0
fi
if [ ! -h $basedir/etc/rc2.d/S99check_parts ] ; then
  echo "creating link for check_parts"
  ln -s /etc/init.d/check_parts $basedir/etc/rc2.d/S99check_parts
fi




