#! /bin/bash
#set up RS485 CAN HAT (B) (https://www.waveshare.com/wiki/RS485_CAN_HAT_(B))
#return 0 if ok, 1 if needs reboot, -1 on error 
#set -x
#testing
BASE=/

WS_COMMENT="#WAVESHARE_DO_NOT_DELETE"

pdir=`dirname $0`
pdir=`readlink -f "$pdir"`

#/boot/config.txt
IFS='' read -r -d '' CFGPAR <<'CFGPAR'
dtparam=spi=on
dtoverlay=mcp2515-can0,oscillator=16000000,interrupt=25,,spimaxfrequency=1000000
dtoverlay=sc16is752-spi1,int_pin=24
CFGPAR

#/etc/network/interfaces.d/can0
CAN0CHECK='can0'
IFS='' read -r -d '' CAN0 << 'CAN0'
#physical can interfaces
allow-hotplug can0
iface can0 can static
bitrate 250000
down /sbin/ip link set $IFACE down
up /sbin/ifconfig $IFACE txqueuelen 10000'
CAN0

writeConsole=1

log(){
    [ $writeConsole = 1 ] && echo "SETUP-WAVESHARE-B: $*"
    logger -t "setup-waveshare-B" "$*"
}

error(){
    log "ERROR: $*"
    exit -1
}

updateConfig(){
    local cfg rt found noCom
    cfg=$1
    noCom=$3
    rt=0 #no change, 1- change, -1 error
    if [ ! -w "$cfg" ] ; then
        log "ERROR: cannot write $cfg"
        return -1
    fi
    if [ "$noCom" = 1 ] ; then
      #fix broken...
      if grep "$WS_COMMENT" $cfg > /dev/null ; then
        log "must fix $cfg"
        sed -i "/$WS_COMMENT/d" $cfg
        rt=1
      fi
    fi    
    while read line
    do
        if [ "$line" != "" ] ; then
            found=0
            if [ "$noCom" = 1 ] ; then
                grep -v "$WS_COMMENT" $cfg | grep -F "$line" > /dev/null 2>&1 && found=1
            else
                grep -F "$line" $cfg > /dev/null 2>&1 && found=1
            fi
            if [ "$found" != 1 ] ; then
                log "add $line to $cfg"
                rt=1
                if [ "$noCom" = 1 ] ; then
                    echo "$line" >> $cfg
                else
                    echo "$line$WS_COMMENT" >> $cfg
                fi
            fi
        fi
    done <<< "$2"
    return $rt
}


doReboot=0
res(){
    [ $1 = 0 ] && return;
    if [ $1 = 1 ] ; then
        doReboot=1
        return
    fi
    error $2
}

usage(){
    echo "usage: $0 [-r] [-c]"
    echo "       -r do not reboot"
    echo "       -c no console messages"
}

canReboot=1
while getopts prcm: opt; do
case $opt in
  r)
    canReboot=0
  ;;
  c)
    writeConsole=0
  ;;
  *)
    echo "invalid option $opt"
    usage
    exit -1
  ;;
esac
done
shift $((OPTIND-1))  

if [ "$1" != "" ] ; then
    BASE="$1"
    log "using base dir $1"
fi    

updateConfig "$BASE/boot/config.txt" "$CFGPAR"
res $? "modify config.txt"
can="$BASE/etc/network/interfaces.d/can0"
canok=0
grep -F "$CAN0CHECK" "$can" > /dev/null 2>&1 && canok=1
if [ "$canok" != 1 ] ; then
  log "creating $can"
  echo "$CAN0" > $can || error "unable to create $can"
fi

log "doReboot=$doReboot, canReboot=$canReboot"

if [ $doReboot = 1 ] ; then
    if [ $canReboot = 0 ] ; then
        log "*** you need to rebot your system to apply the changes ***"
        exit 1
    fi
    log "rebooting now"
    sync
    reboot
    exit 0
fi
log "changes done, no reboot necessary"
exit 0
