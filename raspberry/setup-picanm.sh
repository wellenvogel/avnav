#! /bin/bash
#set up PICAN-M (https://cdn.shopify.com/s/files/1/0563/2029/5107/files/pican-m_UGB_20.pdf?v=1619008196)
#return 0 if ok, 1 if needs reboot, -1 on error 
#set -x
#testing
local pdir=`dirname $0`
pdir=`readlink -f "$pdir"`
. "$pdir/setup-helper.sh"
BASE=/
WS_COMMENT="#PICAN-M_DO_NOT_DELETE"
#/boot/config.txt
IFS='' read -r -d '' CFGPAR <<'CFGPAR'
dtparam=i2c_arm=on
dtparam=spi=on
dtoverlay=mcp2515-can0,oscillator=16000000,interrupt=25
CFGPAR

#/etc/network/interfaces.d/can0
IFS='' read -r -d '' CAN0 << 'CAN0'
#physical can interfaces
allow-hotplug can0
iface can0 can static
bitrate 250000
down /sbin/ip link set $IFACE down
up /sbin/ifconfig $IFACE txqueuelen 10000'
CAN0

if [ "$1" != "" ] ; then
    BASE="$1"
    log "using base dir $1"
fi    

local needReboot=0
local res
checkConfig "$BASE/boot/config.txt" "$WS_COMMENT" "$CFGPAR"
res=$?
[ $res -lt 0 ] && return -1
if [ $res = 1 ] ; then
  needReboot=1
fi

can="$BASE/etc/network/interfaces.d/can0"
checkConfig "$can" "#CAN0" "$CAN0"
res=$?
[ $res -lt 0 ] && return -1
if [ $res = 1 ] ; then
  needReboot=1
fi

$pdir/uart_control gpio

log "needReboot=$needReboot"
return $needReboot
