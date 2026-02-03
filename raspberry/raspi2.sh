#! /bin/bash
pdir=`dirname $0`
mountdir="$pdir/raspi-mount"
partdirs="p2 p1"
MP="/boot/firmware"
loopdevice=""
#set -x
usage(){
    echo "usage: $0 mount|losetup|umount filename"
}
unmount_loop(){
    [ "$loopdevice" = "" ] && return 0
    for pd in `echo $partdirs | tr ' ' '\n' | tac`
    do
        log umount $loopdevice$pd
        umount "$loopdevice$pd"
    done
    umount "$mountdir/p2" 2> /dev/null
    umount "$mountdir/p2$MP" 2> /dev/null
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

do_losetup(){
    loopdevice="`losetup -f --show -P $1`"
    [ "$loopdevice" = "" ] && err no loopdevice after mount2yy
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
    do_losetup  $1
    p2path=""
    for pd in $partdirs
    do
        fn="$loopdevice$pd"
        [ ! -e "$fn" ] && "partition $fn not found"
        if [ "$pd" = "p1" ] ; then
            [ "$p2path" = "" ] && err "partition p2 not mounted before p1"
            mpath="$p2path$MP"
            if [ ! -d "$mpath" ] ; then
                mkdir -p $mpath || err "unable to mkdir $mpath"
            fi
        else
            mpath="$mountdir/$pd"
            p2path=$mpath
        fi
        log mounting $fn to $mpath
        mount $fn "$mpath" || err "unable to mount $fn to $mpath"
    done
    exit 0
fi
if [ "$mode" = "losetup" ] ; then
    [ "$1" = "" ] && err "missing filename"
    [ ! -e "$1" ] && err "$1 not found"
    ensure_mp
    $0 umount $1 ignore
    do_losetup  $1
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
if [ "$mode" = "extend" ] ; then
    [ "$1" = "" ] && err "missing filename"
    [ ! -f "$1" ] && err "file $1 not found"
    [ "$2" = "" ] && err "missing size (MB)"
    ensure_mp
    $0 umount $1 ignore
    echo "adding $2 MB to $1"
    dd bs=1M count=$2 < /dev/zero >> $1 || err "unable to enlarge $1"
    do_losetup  $1
    gparted $loopdevice
    unmount_loop
    exit 0
fi
err invalid mode $mode
