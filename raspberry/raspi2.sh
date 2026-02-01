#! /bin/bash
pdir=`dirname $0`
mountdir="$pdir/raspi-mount"
partdirs="p1 p2"
loopdevice=""
#set -x
usage(){
    echo "usage: $0 mount|losetup|umount filename"
}
unmount_loop(){
    [ "$loopdevice" = "" ] && return 0
    for pd in $partdirs
    do
        log umount $loopdevice$pd
        umount "$loopdevice$pd"
        umount "$mountdir/$pd" 2> /dev/null
    done
    log losetup -d $loopdevice
    losetup -d "$loopdevice"
}
err(){
    echo "ERROR: $*"
    unmount_loop
    exit 1
}
log(){
    echo $*
}

ensure_mp(){
    for pd in $partdirs
    do
        fd="$mountdir/$pd"
        if [ ! -d "$fd" ] ; then
            log "creating $fd"
            mkdir -p $fd || err unable to create $fd
        fi
    done
}

if [ "$*" = "" ] ; then
    usage
    err missing parameter
fi

mode="$1"
shift
if [ "$mode" = "mount" ] ; then
    [ "$1" = "" ] && err "missing filename"
    [ ! -e "$1" ] && err "$1 not found"
    ensure_mp
    $0 umount $1 ignore
    loopdevice="`losetup -f --show -P $1`"
    [ "$loopdevice" = "" ] && err no loopdevice after mount
    for pd in $partdirs
    do
        fn="$loopdevice$pd"
        [ ! -e "$fn" ] && "partition $fn not found"
        log mounting $fn to $mountdir/$pd
        mount $fn "$mountdir/$pd"
    done
    exit 0
fi
if [ "$mode" = "losetup" ] ; then
    [ "$1" = "" ] && err "missing filename"
    [ ! -e "$1" ] && err "$1 not found"
    ensure_mp
    $0 umount $1 ignore
    loopdevice="`losetup -f --show -P $1`"
    [ "$loopdevice" = "" ] && err no loopdevice after mount
    echo loopdevice $loopdevice
    exit 0
fi
if [ "$mode" = "umount" ] ; then
    [ "$1" = "" ] && err "missing filename"
    alldev="`losetup -O NAME -n -j $1`"
    if [ "$alldev" = "" ] ; then
        [ "$2" = "ignore" ] && exit 0
        err no loopdevice for $1
    fi
    for loopdevice in $alldev
    do
        unmount_loop
    done
    exit 0
fi
err invalid mode $mode
