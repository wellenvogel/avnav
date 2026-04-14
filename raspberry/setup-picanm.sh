#! /bin/bash
#set up PICAN-M (https://cdn.shopify.com/s/files/1/0563/2029/5107/files/pican-m_UGB_20.pdf?v=1619008196)
#return 0 if ok, 1 if needs reboot, -1 on error 
#set -x
#testing
. "$AVNAV_SETUP_HELPER"
BASE=/
WS_COMMENT="#PICAN-M_DO_NOT_DELETE"
#/boot/firmware/config.txt
read -r -d '' CFGPAR <<'CFGPAR'
dtparam=i2c_arm=on
dtparam=spi=on
dtoverlay=mcp2515-can0,oscillator=16000000,interrupt=25
CFGPAR

needsReboot=0
if [ "$1" = $MODE_DIS ]; then
  removeConfig "$BOOTCONFIG" "$WS_COMMENT"
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
