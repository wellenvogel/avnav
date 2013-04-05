#! /bin/sh
# vim: ts=2 et sw=2
#create our diskimage out of the PI SD card
#we assume 2 or 3 partitions - anyway we throw away the 3rd one
PARTED=/sbin/parted
doShrink=0
#megabytes
minsize=2048
doLoopmount=0
shrinkOnly=0

err(){
  echo "ERROR: $*"
  exit 1
}

wlog(){
  echo "INFO: $*"
}

usage(){
  echo "usage: $0 [-s] [-o] [-l] [-m minsizeMB] infile outfile"
  [ "$1" != "" ] && exit 1
}

while getopts olsm: opt ; do
  case $opt in
    o)
	    shrinkOnly=1
	    ;;
    s)
	    doShrink=1
	    ;;
    l)
	    doLoopmount=1
	    ;;
    m)
      minsize=$OPTARG
      ;;
    *)
      usage 1
  esac
done

shift `expr $OPTIND - 1`
     	

[ "$1" = "" ] && usage 1
[ -x $PARTED ] || err "$PARTED not found"
dev=$1
shift
if [ "$1" != "" ] ; then
  [ "$shrinkOnly" = "1" ] && err "cannot provide second arg with -o"
  outfile=$1
else
  outfile=avnav.img
fi
if [ "$shrinkOnly" = "1" ]; then
  outfile=$dev
fi


partstart=`$PARTED -m $dev unit B print | grep '^2:' | awk -F: '{ print substr($2,0,length($2))} '` || err "unable to get partstart"
partend=`$PARTED -m $dev unit B print | grep '^2:' | awk -F : '{ print substr($3,0,length($3));}'` || err "unable to get partend"
[ "$partend" = "" ] && err "unable to find end of second partition in $dev"
wlog "start=$partstart, end=$partend"
if [ "$shrinkOnly" != "1" ] ; then
  wlog "reading from $dev to $outfile"
  blks=`echo "$partend / (4096 * 1024) + 1"| bc`
  wlog "reading $blks 4M blocks (from $partend bytes)"

  dd if=$dev of=$outfile bs=4M count=$blks || err "unable to read $blks to $outfile"
fi

wlog "now going to remove 3rd partition"
$PARTED $outfile rm 3
if [ "$doShrink" = "1" ] ; then
  mustshrink=`echo "m=$minsize*1024*1024;s=$partend-$partstart;if ( s<= m) c=0 else c=1;c" | bc`
  if [ "$mustshrink" = "1" ] ; then
    loopback=`losetup -f --show -o $partstart $outfile` || err "losetup failed"
    e2fsck -f $loopback
    fsminsize=`resize2fs -P $loopback | awk -F': ' ' { print $2 } '` || err "unable to get minsize"
    newminsize=`echo "a=$minsize*1024*1024/4096;b=$fsminsize+1000;if (a<b) c=b else c=a;c" | bc` || err "failed computing new size"
    resize2fs -p $loopback $newminsize || err "resize failed"
    sleep 1
    losetup -d $loopback
    partnewsize=`echo "$newminsize * 4096" | bc` 
    partend=`echo "$partstart + $partnewsize" | bc` || err "unable to compute new end"
    part1=`parted $outfile rm 2`
    part2=`parted $outfile unit B mkpart primary $partstart $partend`
    wlog "start=$partstart, end=$partend"
    endresult=`parted -m $outfile unit B print  | grep '^2:' | awk -F: ' { print substr($3,0,length($3)) } '` || err "unable to get new size"
    endresult=`echo $endresult + 1|bc`
    wlog truncating image to $endresult
    truncate -s $endresult $outfile
  else
    wlog "no need to shrink - partition does not exceed minsize"
  fi
fi

if [ "$doLoopmount" = "1" ] ; then
  loopback=`losetup -f --show -o $partstart $outfile` || err "losetup failed"
  wlog "loop mount of second partition at $loopback"
else
  wlog "you can loop mount the second partition with:"
  wlog "losetup -f --show -o $partstart $outfile"
fi
wlog "umount when done with losetup -d $loopback"

wlog "done"



