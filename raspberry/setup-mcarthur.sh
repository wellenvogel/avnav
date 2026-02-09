#! /bin/bash
#set up Openmarine McArthur HAT (https://github.com/OpenMarine/MacArthur-HAT)
#return 0 if ok, 1 if needs reboot, -1 on error 
#set -x
#testing
. "$AVNAV_SETUP_HELPER"


is_pifive() {
  grep -q "^Revision\s*:\s*[ 123][0-9a-fA-F][0-9a-fA-F]4[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]$" /proc/cpuinfo
  return $?
}

BASE=/
if is_pifive; then
WS_COMMENT="#MCARTHUR_DO_NOT_DELETE"
read -r -d '' CFGPAR <<'CFGPAR'
dtparam=i2c_arm=on
dtparam=spi=on
dtoverlay=mcp251xfd,spi0-1,oscillator=20000000,interrupt=25
dtoverlay=w1-gpio,gpiopin=19
dtoverlay=uart2-pi5
dtoverlay=uart4-pi5
CFGPAR
else
WS_COMMENT="#MCARTHUR_DO_NOT_DELETE"
read -r -d '' CFGPAR <<'CFGPAR'
dtparam=i2c_arm=on
dtparam=spi=on
dtoverlay=mcp251xfd,spi0-1,oscillator=20000000,interrupt=25
dtoverlay=w1-gpio,gpiopin=19
dtoverlay=uart3
dtoverlay=uart5
CFGPAR
fi

needsReboot=0
if [ "$1" = $MODE_DIS ]; then
  removeConfig "$BOOTCONFIG" "$WS_COMMENT"
  checkRes
  /usr/bin/systemctl disable can-if@can0.service
  checkRes
  exit $needsReboot
fi

if [ "$1" = $MODE_EN ] ; then
  checkConfig "$BOOTCONFIG" "$WS_COMMENT" "$CFGPAR"
  checkRes
  /usr/bin/systemctl enable can-if@can0.service
  checkRes
  cat /home/pi/.signalk/settings.json | jq '.pipedProviders += [{ "enabled": "true", "id": "MCARTHUR_SEATALK", "pipeElements": [{ "options" : { "logging" : false, "subOptions" : { "gpio": "GPIO20", "gpioInvert": false }, "type": "Seatalk" }, "type": "providers/simple"}] }]' > /tmp/settings.json
  mv /tmp/settings.json /home/pi/.signalk/settings.json
  chown pi:pi /home/pi/.signalk/settings.json
  log "needReboot=$needsReboot"
  exit $needsReboot
fi



exit 0
