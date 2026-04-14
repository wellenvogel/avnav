#! /bin/bash
#set up RS485_CAN_HAT (https://www.waveshare.com/wiki/RS485_CAN_HAT)
#return 0 if ok, 1 if needs reboot, -1 on error 
#set -x
#testing
BASE=/

WS_COMMENT="#WAVESHAREA8_DO_NOT_DELETE"
. "$AVNAV_SETUP_HELPER"

#/boot/config.txt
read -r -d '' CFGPAR <<'CFGPAR'
dtparam=spi=on
dtoverlay=mcp2515-can0,oscillator=8000000,interrupt=25,spimaxfrequency=1000000
CFGPAR

needsReboot=0
if [ "$1" = $MODE_DIS ] ; then
    removeConfig $BOOTCONFIG "$WS_COMMENT" "$CFGPAR"
    checkRes
    /usr/bin/systemctl disable can-if@can0.service
    checkRes
    `dirname $0`/uart_control default
    exit $needsReboot
fi

if [ "$1" = $MODE_EN ] ; then
    checkConfig "$BOOTCONFIG" "$WS_COMMENT" "$CFGPAR"   
    checkRes
    /usr/bin/systemctl enable can-if@can0.service
    checkRes
    `dirname $0`/uart_control gpio
    log "needReboot=$needsReboot"
    exit $needsReboot
fi
exit 0
