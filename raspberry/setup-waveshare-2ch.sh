#! /bin/bash
#set up waveshare 2 channel can HAT https://www.waveshare.com/wiki/2-CH_CAN_HAT
#return 0 if ok, 1 if needs reboot, -1 on error 
#set -x
#testing
BASE=/

WS_COMMENT="#WAVESHARE2CH_DO_NOT_DELETE"
. "$AVNAV_SETUP_HELPER"

#/boot/config.txt
read -r -d '' CFGPAR <<'CFGPAR'
dtparam=spi=on
dtoverlay=mcp2515-can0,oscillator=16000000,interrupt=23
dtoverlay=mcp2515-can1,oscillator=16000000,interrupt=25
CFGPAR

#/etc/network/interfaces.d/can0
read -r -d '' CAN0 << 'CAN0'
#physical can interfaces
auto can0
iface can0 can static
bitrate 250000
pre-up /sbin/ip link set $IFACE type can restart-ms 100
down /sbin/ip link set $IFACE down
up /sbin/ifconfig $IFACE txqueuelen 10000
CAN0

canif0="$BASE/etc/network/interfaces.d/can0"

#/etc/network/interfaces.d/can1
read -r -d '' CAN1 << 'CAN1'
#physical can interfaces
auto can1
iface can1 can static
bitrate 250000
pre-up /sbin/ip link set $IFACE type can restart-ms 100
down /sbin/ip link set $IFACE down
up /sbin/ifconfig $IFACE txqueuelen 10000
CAN1

canif1="$BASE/etc/network/interfaces.d/can1"

needsReboot=0
if [ "$1" = $MODE_DIS ] ; then
    removeConfig $BOOTCONFIG "$WS_COMMENT" "$CFGPAR"
    checkRes
    exit $needsReboot
fi

if [ "$1" = $MODE_EN ] ; then
    checkConfig "$BOOTCONFIG" "$WS_COMMENT" "$CFGPAR"
    checkRes
    replaceConfig "$canif0" "$CAN0"
    checkRes
    replaceConfig "$canif1" "$CAN1"
    checkRes
    log "needReboot=$needsReboot"
    exit $needsReboot
fi

exit 0
