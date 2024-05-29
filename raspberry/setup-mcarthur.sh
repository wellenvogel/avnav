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
#/boot/config.txt
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
#/boot/config.txt
read -r -d '' CFGPAR <<'CFGPAR'
dtparam=i2c_arm=on
dtparam=spi=on
dtoverlay=mcp251xfd,spi0-1,oscillator=20000000,interrupt=25
dtoverlay=w1-gpio,gpiopin=19
dtoverlay=uart3
dtoverlay=uart5
CFGPAR
fi

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

can="$BASE/etc/network/interfaces.d/can0"
needsReboot=0
if [ "$1" = $MODE_DIS ]; then
  removeConfig "$BOOTCONFIG" "$WS_COMMENT"
  checkRes
  exit $needsReboot
fi

if [ "$1" = $MODE_EN ] ; then
  checkConfig "$BOOTCONFIG" "$WS_COMMENT" "$CFGPAR"
  checkRes
  replaceConfig "$can" "$CAN0"
  checkRes
  cat /home/pi/.signalk/settings.json | jq '.pipedProviders += [{ "enabled": "true", "id": "MCARTHUR_SEATALK", "pipeElements": [{ "options" : { "logging" : false, "subOptions" : { "gpio": "GPIO20", "gpioInvert": false }, "type": "Seatalk" }, "type": "providers/simple"}] }]' > /tmp/settings.json
  mv /tmp/settings.json /home/pi/.signalk/settings.json
  chown pi:pi /home/pi/.signalk/settings.json
  log "needReboot=$needsReboot"
  exit $needsReboot
fi



exit 0
