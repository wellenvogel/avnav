#! /bin/bash
#set up MCS
#return 0 if ok, 1 if needs reboot, -1 on error 
#set -x
#testing
BASE=/

MCS_COMMENT="#MCS_DO_NOT_DELETE"

MCS_PACKAGE=/home/pi/.signalk/node_modules/signalk-raspberry-mcs
MCS_SERVICE_SCRIPT=MCS-asd.py

pdir=`dirname $0`
pdir=`readlink -f "$pdir"`

if [ -f "$pdir/$MCS_SERVICE_SCRIPT" ] ; then
    MCS_PACKAGE="$pdir"
fi

PACKAGES="python3 pigpio python3-pigpio python3-rpi.gpio"
#/boot/config.txt
IFS='' read -r -d '' CFGPAR <<'CFGPAR'
dtoverlay=sc16is752-i2c,int_pin=13,addr=0x4c,xtal=14745600
dtoverlay=sc16is752-i2c,int_pin=12,addr=0x49,xtal=14745600
dtoverlay=sc16is752-i2c,int_pin=6,addr=0x48,xtal=14745600
dtoverlay=mcp2515-can1,oscillator=16000000,interrupt=25
dtoverlay=spi-bcm2835-overlay
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

#/etc/modules
IFS='' read -r -d '' MODULES << 'MODULES'
i2c_dev
ds2482
wire
MODULES

#/etc/systemd/system/mcsowire.service
OWIRE_SERVICE=/etc/systemd/system/mcsowire.service
IFS='' read -r -d '' OWIRE << 'EOWIRE'
[Unit]
Description=MCS owire start service
After=multi-user.target
[Service]
Type=oneshot
ExecStart=/bin/sh -c '[ ! -d /sys/bus/i2c/devices/i2c-1/1-0018/ ] && echo ds2482 0x18 > /sys/bus/i2c/devices/i2c-1/new_device || echo "no set up"'
[Install]
WantedBy=multi-user.target
EOWIRE

#/etc/systemd/system/mcsasd.service
MCSASD_SERVICE=/etc/systemd/system/mcsasd.service
IFS='' read -r -d '' MCSASD << 'EMCSASD'
[Unit]
Description=MCS autoshutdown start service
After=multi-user.target
[Service]
Type=simple
ExecStart=/usr/bin/python3 @dir@/MCS-asd.py
[Install]
WantedBy=multi-user.target
EMCSASD

writeConsole=1

log(){
    [ $writeConsole = 1 ] && echo "SETUP-MCS: $*"
    logger -t "setup-mcs" "$*"
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
      if grep "$MCS_COMMENT" $cfg > /dev/null ; then
        log "must fix $cfg"
        sed -i "/$MCS_COMMENT/d" $cfg
        rt=1
      fi
    fi    
    while read line
    do
        if [ "$line" != "" ] ; then
            found=0
            if [ "$noCom" = 1 ] ; then
                grep -v "$MCS_COMMENT" $cfg | grep -F "$line" > /dev/null 2>&1 && found=1
            else
                grep -F "$line" $cfg > /dev/null 2>&1 && found=1
            fi
            if [ "$found" != 1 ] ; then
                log "add $line to $cfg"
                rt=1
                if [ "$noCom" = 1 ] ; then
                    echo "$line" >> $cfg
                else
                    echo "$line$MCS_COMMENT" >> $cfg
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
    echo "usage: $0 [-p] [-r] [-c] [-m mcspath]"
    echo "       -p do not try to install packages"
    echo "       -r do not reboot"
    echo "       -c no console messages"
    echo "       -m path to MCS module, default: $MCS_PACKAGE"
}

installPackages=1
canReboot=1
while getopts prcm: opt; do
case $opt in
  p)
    installPackages=0
  ;;
  r)
    canReboot=0
  ;;
  c)
    writeConsole=0
  ;;
  m)
    MCS_PACKAGE="$OPTARG"
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
updateConfig "$BASE/etc/modules" "$MODULES" 1
res $? "update /etc/modules"
can="$BASE/etc/network/interfaces.d/can0"
canok=0
grep -F "$CAN0CHECK" "$can" > /dev/null 2>&1 && canok=1
if [ "$canok" != 1 ] ; then
  log "creating $can"
  echo "$CAN0" > $can || error "unable to create $can"
fi

scfg="$BASE$OWIRE_SERVICE"
log "creating $scfg"
echo "$OWIRE" > "$scfg" ||  error "unable to create $scfg"
scfg="$BASE$MCSASD_SERVICE"
log "creating $scfg"
echo "${MCSASD/@dir@/$MCS_PACKAGE}" > "$scfg" ||  error "unable to create $scfg"
systemctl --no-ask-password enable mcsowire.service
systemctl --no-ask-password enable mcsasd.service
if [ "$installPackages" = 1 ] ; then
    log "installing $PACKAGES"
    apt-get update
    apt-get install -y $PACKAGES
fi
systemctl --no-ask-password enable pigpiod

PIGPIO_OVERRIDE=/etc/systemd/system/pigpiod.service.d/stop-timeout.conf
if [ ! -f "$PIGPIO_OVERRIDE" ] ; then
    log "creating $PIGPIO_OVERRIDE"
    dn=`dirname "$PIGPIO_OVERRIDE"`
    if [ ! -d "$dn" ]; then
        mkdir -p $dn
    fi
    echo "[Service]" > "$PIGPIO_OVERRIDE"
    echo "TimeoutStopSec=5" >> "$PIGPIO_OVERRIDE"
fi

if [ $doReboot = 0 ]; then
    log "daemon reload"
    systemctl --no-ask-password daemon-reload
    log "restarting service pigpiod"
    systemctl --no-ask-password --no-block restart pigpiod
    log "restarting service mcsowire.service"
    systemctl --no-ask-password --no-block restart mcsowire.service
    log "restarting service mcsasd.service"
    systemctl --no-ask-password --no-block restart mcsasd.service
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






