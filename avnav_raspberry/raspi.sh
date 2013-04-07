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

#general raspi image handling stuff
#create our diskimage out of the PI SD card
#we assume 2 or 3 partitions - anyway we throw away the 3rd one
PARTED=/sbin/parted
doShrink=0
#megabytes
minsize=2048
doLoopmount=0
shrinkOnly=0
mode=help

err(){
  echo "ERROR: $*"
  [ "$loopback" != "" ] && losetup -d $loopback
  exit 1
}


wlog(){
  echo "INFO: $*"
}

#get the start of a partition in bytes
#p1 image or device 
#p2 image number 1...
getPartStart(){
  $PARTED -m $1 unit B print | grep "^$2:" | awk -F: '{ print substr($2,0,length($2))} ' || err "unable to get partstart"
}

#get the end of a partition in bytes
#p1 image or device 
#p2 image number 1...
getPartEnd(){
  $PARTED -m $1 unit B print | grep "^$2:" | awk -F : '{ print substr($3,0,length($3));}' || err "unable to get partend"
}

#get the last used byte from the partition table
#p1 the image
#p2 if set - use this partition as the last
getLastUsed(){
  if [ "$2" != "" ]; then
    $PARTED -m $1 unit B print  | grep "^$2:" | awk -F: ' { print substr($3,0,length($3)) } ' || err "unable get used size"
  else
    $PARTED -m $1 unit B print  | tail -1 | awk -F: ' { print substr($3,0,length($3)) } ' || err "unable get used size"
  fi
}

#remove all partitions behind the second
#p1 image
removeParts(){
  $PARTED -m $1 print |  awk -F : '/^[0-9]*:/{ if ($1 != "1" && $1 != "2") print $1 ;}' | xargs -L 1 -r $PARTED $1 rm 
  [ $? != 0 ] && err "unable to remove partitions from $1"
}

#get the list of partitions
#p1 image
#p2 if set, list only parts except 1 and 2
getParts(){
  if [ "$2" = "" ] ; then
    $PARTED -m $1 print |  awk -F : '/^[0-9]*:/{ print $1 ;}' || "err unable to remove partitions from $1"
  else
    $PARTED -m $1 print |  awk -F : '/^[0-9]*:/{ if ($1 != "1" && $1 != "2" ) {print $1} ;}' || "err unable to remove partitions from $1"
  fi
}

#truncate an image file to the end of partition 2
#p1 - the image
#p2 - if set, otherwise to the last used partition
truncateTo(){
  endresult=`getLastUsed $1 $2`
  endresult=`echo $endresult + 1|bc`
  [ "$endresult" != "" ] || err "unable to compute new size for image $1"
  wlog truncating $1 to $endresult
  truncate -s $endresult $1 || err "truncate of $1 to $endresult failed"
  finalMB=`echo "$endresult/(1024*1024)" | bc `
  wlog "truncate $1 finished, final size is $finalMB MBytes"
}

#shrink the second partition
#p1 the image
#p2 if set, check only (do not really shrink)
shrinkSecond(){
    partstart=`getPartStart $1 2`
    partend=`getPartEnd $1 2`
    [ "$partstart" != "" ] || err "unable to read start of partition 2 from $1 for shrink"
    loopback=`losetup -f --show -o $partstart $1` || err "losetup failed"
    wlog "running e2fsck on $loopback"
    e2fsck -f $loopback
    fsminsize=`resize2fs -P $loopback | awk -F': ' ' { print $2 } '` || err "unable to get minsize"
    [ "$fsminsize" != "" ] || err "unable to query minsize of partition 2 from $1"
    newminsize=`echo "a=$minsize*1024*1024/4096;b=$fsminsize+1000;if (a<b) c=b else c=a;c" | bc` || err "failed computing new size"
    doesFit=`echo "a=$partend;b=$partstart;c=$newminsize;d=a-b;b=b*4096;if (d < b) r=0 else r=1;r" | bc`
    [ "$doesFit" != "1" ] || err "shrinking not possible, $newminsize 4k blocks doe not fit into partition"
    if [ "$2" = "" ] ; then
      wlog "shrinking partition 2 of $1 to $newminsize 4k blocks"
      resize2fs -p $loopback $newminsize || err "shrink failed"
      sleep 1
    fi
    losetup -d $loopback
    [ "$2" != "" ] && return
    partnewsize=`echo "$newminsize * 4096" | bc` 
    partend=`echo "$partstart + $partnewsize" | bc` || err "unable to compute new end"
    [ "$partend" != "" ] || err "unable to compute new end for partition"
    part1=`$PARTED $1 rm 2`
    part2=`$PARTED $1 unit B mkpart primary $partstart $partend`
    wlog "start=$partstart, end=$partend"
}

usage(){
  echo "usage: $0 -m mode [-s] [-o] [-l] [-x minsizeMB] infile outfile"
  echo "       $0 -m list infile : list partitions and sizes"
  echo "       $0 -m copy [-s] [-x minsizeMB] infile outfile"
  echo "             copy from infile to outfile, omitting any partition behind the second"
  echo "             if -s is given additionally shrink the second partition to the possible minsize (or the given one)"
  echo "       $0 -m mount infile mountdir"
  echo "             mount the available partitions 1 and 2 to mountdir/part1, mountdir/part2"
  echo "       $0 -m umount infile"
  echo "             check if infile is loop mounted and unmount"
  echo "       $0 -m completeCopy infile outfile"
  echo "             make a complete copy but limit to the used space"
  echo "       $0 -m shrink [-x minsizeMB] infile "
  echo "             shrink the second partition (and omit any further)"
  [ "$1" != "" ] && exit 1
}

while getopts x:sm: opt ; do
  case $opt in
    s)
	    doShrink=1
	    ;;
    x)
      minsize=$OPTARG
      ;;
    m)
      mode=$OPTARG
      ;;
    *)
      usage 1
  esac
done

shift `expr $OPTIND - 1`
     	
[ "$mode" = "help" ] && usage 1
[ "$1" = "" ] && usage 1
[ -x $PARTED ] || err "$PARTED not found"

case $mode in
  list)
    $PARTED $1 unit GB print
    exit 0
    ;;
  copy)
    [ "$1" = "" -o "$2" = "" ] && usage 1 
    [ ! -e $1 ] && err "file $1 not found"
    partend=`getPartEnd $1 2`
    [ "$partend" != "" ] || err "unable to determine end of partition2 for $1"
    wlog "reading from $1 to $2"
    blks=`echo "$partend / (4096 * 1024) + 1"| bc`
    rmparts=`getParts $1 1`
    wlog "must remove parts: $rmparts"
    wlog "reading $blks 4M blocks (from $partend bytes)"
    dd if=$1 of=$2 bs=4M count=$blks || err "unable to copy $blks from $1 to $2"
    if [ "$doShrink" = "1" ] ; then
      for p in $rmparts
      do
        wlog "remove partition $p"
        $PARTED $2 rm $p || err "unable to remove partition $p"
      done
      shrinkSecond $2 
    fi
    truncateTo $2 2
    wlog "image $2 successfully created"
    exit 0
    ;;
  completeCopy)
    [ "$1" = "" -o "$2" = "" ] && usage 1 
    [ ! -e $1 ] && err "file $1 not found"
    partend=`getLastUsed $1`
    partend=`echo $partend + 1|bc`
    [ "$partend" != "" ] || err "unable to compute used size for image $1"
    blks=`echo "$partend / (4096 * 1024) + 1"| bc`
    wlog "reading $blks 4M blocks (from $partend bytes)"
    dd if=$1 of=$2 bs=4M count=$blks || err "unable to copy $blks from $1 to $2"
    wlog "image $2 successfully created"
    exit 0
    ;;
  mount)
    [ "$1" = "" -o "$2" = "" ] && usage 1 
    [ ! -e $1 ] && err "file $1 not found"
    [ ! -d $2 ] && err "$2 is no directory"
    for part in `getParts $1`
    do
      partdir=$2/part$part
      if [ ! -d $partdir ] ; then
        mkdir -p $partdir || err "unable to create partdir $partdir"
      fi
      partstart=`getPartStart $1 $part`
      loopback=`losetup -f --show -o $partstart $1` || err "losetup failed"
      wlog "partition $part loop mounted at $loopback offset $partstart"
      wlog "mounting partition $part $loopback at $partdir"
      mount $loopback $partdir || wlog "!!! unable to mount partition $part at $partdir"
    done
    exit 0
    ;;
  umount)
    [ "$1" != "" ] || usage 1 
    loopdevs=`losetup -a | grep $1 | sed 's/^\([^:]*\).*/\1/'`
    if [ "$loopdevs" = "" ] ; then
      wlog "no loop devices found for $1"
      exit 0
    fi
    for dev in $loopdevs
    do
      wlog "trying to umount $dev"
      umount $dev
      losetup -d $dev
    done
    exit 0
    ;;
  shrink)
    [ "$1" != "" ] || usage 1 
    [ "$2" = "" ] || err "cannot provide 2 parameters for shrink"
    removeParts $1
    shrinkSecond $1
    truncateTo $1 2
    wlog "successfully shrinked $1"
    exit 0
    ;;
  *)
    echo "invalid mode $mode"
    usage 1
    ;;
esac



