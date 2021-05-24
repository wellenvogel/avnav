#! /bin/sh
#rename the interface depending on the config
#AVNAV_WIFI_CLIENT (LAST_WIFI_CLIENT)
#if not set or not true - normal behavior
#internal WLAN will become wlan-ap, one external wlan-av1
#if set - internal chip will become wlan-av1
#set -x
pdir=`dirname $0`
log(){
    logger -t 'avnav-rename-if' $*
}
config=/etc/avnav-startup-checks
[ -f $config ] && . $config

swap=0
if [ "$LAST_WIFI_CLIENT" = "yes" ] ; then
  swap=1
fi
log "if=$1, modul=$2, swap=$swap"

rt=""
if [ "$2" = "mmc1:0001:1" ] ; then
  #built in wlan
  if [ $swap = 0 ] ; then
    rt="wlan-ap"
  else
    rt="wlan-av1"
  fi
else
 #other adapter
 if [ $swap = 0 ] ; then
   rt="wlan-av1"
 else
   rt="wlan-ap"
 fi
fi
log "name=$rt"
echo "$rt"

