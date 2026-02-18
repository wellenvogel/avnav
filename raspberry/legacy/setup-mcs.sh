#! /bin/bash
#set up MCS
#return 0 if ok, 1 if needs reboot, -1 on error 
#set -x
#testing
BASE=/

if [ "$AVNAV_SETUP_HELPER" != "" ] ; then
    . "$AVNAV_SETUP_HELPER"
else
    . `dirname $0`/setup-helper.sh
fi    

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
read -r -d '' CFGPAR <<'CFGPAR'
dtoverlay=sc16is752-i2c,int_pin=13,addr=0x4c,xtal=14745600
dtoverlay=sc16is752-i2c,int_pin=12,addr=0x49,xtal=14745600
dtoverlay=sc16is752-i2c,int_pin=6,addr=0x48,xtal=14745600
dtparam=spi=on
dtparam=i2c_arm=on
dtoverlay=mcp2515-can1,oscillator=16000000,interrupt=25
CFGPAR

#/etc/network/interfaces.d/can0
CAN0CHECK='can0'
read -r -d '' CAN0 << 'CAN0'
#physical can interfaces
auto can0
iface can0 can static
bitrate 250000
pre-up /sbin/ip link set $IFACE type can restart-ms 100
down /sbin/ip link set $IFACE down
up /sbin/ifconfig $IFACE txqueuelen 10000'
CAN0

#/etc/modules
read -r -d '' MODULES << 'MODULES'
i2c_dev
ds2482
wire
MODULES

#/etc/systemd/system/mcsowire.service
OWIRE_SERVICE=/etc/systemd/system/mcsowire.service
read -r -d '' OWIRE << 'EOWIRE'
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
read -r -d '' MCSASD << 'EMCSASD'
[Unit]
Description=MCS autoshutdown start service
After=multi-user.target
[Service]
Type=simple
ExecStart=/usr/bin/python3 @dir@/MCS-asd.py
[Install]
WantedBy=multi-user.target
EMCSASD

#
PIGPIO_OVERRIDE=/etc/systemd/system/pigpiod.service.d/stop-timeout.conf
read -r -d '' PIGPIO << 'PIGPIO'
[Service]
TimeoutStopSec=5
PIGPIO


needsReboot=0

usage(){
    echo "usage: $0 [-p] [-r] [-c] [-m mcspath] enable|disable"
    echo "       -p do not try to install packages"
    echo "       -m path to MCS module, default: $MCS_PACKAGE"
}

installPackages=1
while getopts pcm: opt; do
case $opt in
  p)
    installPackages=0
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

if [ "$1" = $MODE_EN ] ; then
checkConfig "$BOOTCONFIG" "$MCS_COMMENT" "$CFGPAR"
checkRes
checkConfig "$BASE/etc/modules" "$MCS_COMMENT" "$MODULES" 1
checkRes
can="$BASE/etc/network/interfaces.d/can0"
replaceConfig "$can" "$CAN0"
checkRes
scfg="$BASE$OWIRE_SERVICE"
replaceConfig "$scfg" "$OWIRE"
checkRes
scfg="$BASE$MCSASD_SERVICE"
replaceConfig "$scfg" "${MCSASD/@dir@/$MCS_PACKAGE}"
checkRes
systemctl --no-ask-password enable mcsowire.service
systemctl --no-ask-password enable mcsasd.service
if [ "$installPackages" = 1 ] ; then
    log "installing $PACKAGES"
    apt-get update
    apt-get install -y $PACKAGES
fi
systemctl --no-ask-password enable pigpiod

replaceConfig "$BASE$PIGPIO_OVERRIDE" "$PIGPIO"

if [ $needsReboot = 0 ]; then
    log "daemon reload"
    systemctl --no-ask-password daemon-reload
    log "restarting service pigpiod"
    systemctl --no-ask-password --no-block restart pigpiod
    log "restarting service mcsowire.service"
    systemctl --no-ask-password --no-block restart mcsowire.service
    log "restarting service mcsasd.service"
    systemctl --no-ask-password --no-block restart mcsasd.service
fi
log "needsReboot=$needsReboot"
exit $needsReboot
fi

if [ "$1" = $MODE_DIS ] ; then
    log mcs disable
    systemctl --no-ask-password disable mcsowire.service
    systemctl --no-ask-password disable mcsasd.service
    removeConfig "$BOOTCONFIG" "$MCS_COMMENT"
    removeConfig "$BASE/etc/modules" "$MCS_COMMENT"
    rm -f "$BASE$OWIRE_SERVICE"
    rm -f "$BASE$MCSASD_SERVICE"
    rm -f "$BASE$PIGPIO_OVERRIDE"
    exit 0
fi

errExit invalid mode $1
