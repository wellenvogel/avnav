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

needsReboot=0
if [ "$1" = $MODE_DIS ] ; then
    removeConfig $BOOTCONFIG "$WS_COMMENT" "$CFGPAR"
    checkRes
    /usr/bin/systemctl disable can-if@can0.service
    checkRes
    /usr/bin/systemctl disable can-if@can1.service
    checkRes
    exit $needsReboot
fi

if [ "$1" = $MODE_EN ] ; then
    checkConfig "$BOOTCONFIG" "$WS_COMMENT" "$CFGPAR"
    checkRes
    /usr/bin/systemctl enable can-if@can0.service
    checkRes
    /usr/bin/systemctl enable can-if@can1.service
    checkRes
    log "needReboot=$needsReboot"
    exit $needsReboot
fi

exit 0
