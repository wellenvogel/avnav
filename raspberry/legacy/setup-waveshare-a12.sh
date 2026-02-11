#! /bin/bash
#set up RS485_CAN_HAT (https://www.waveshare.com/wiki/RS485_CAN_HAT)
#return 0 if ok, 1 if needs reboot, -1 on error 
#set -x
#testing
BASE=/

WS_COMMENT="#WAVESHAREA12_DO_NOT_DELETE"
. "$AVNAV_SETUP_HELPER"

#/boot/config.txt
read -r -d '' CFGPAR <<'CFGPAR'
dtparam=spi=on
dtoverlay=mcp2515-can0,oscillator=12000000,interrupt=25,spimaxfrequency=1000000
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
needsReboot=0
if [ "$1" = $MODE_DIS ] ; then
    removeConfig $BOOTCONFIG "$WS_COMMENT" "$CFGPAR"
    checkRes
    exit $needsReboot
fi

if [ "$1" = "$MODE_EN" ] ; then
    checkConfig "$BOOTCONFIG" "$WS_COMMENT" "$CFGPAR"
    checkRes
    can="$BASE/etc/network/interfaces.d/can0"
    replaceConfig "$can" "$CAN0"
    checkRes
    `dirname $0`/uart_control gpio
    log "needReboot=$needsReboot"
    exit $needsReboot
fi

exit 0

