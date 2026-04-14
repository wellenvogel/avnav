#! /bin/bash
usage(){
  echo "usage: $0 device check|restart"
}
err(){
  echo "ERROR $*"
  exit 1
}
log(){
  echo "LOG $*"
}

if [ "$#" -ne 2 ] ; then
  usage
  err invalid usage
fi
if [ "$2" != "check" -a "$2" != "restart" ] ; then
  usage
  err invalid mode, expected restart or check
fi
dpath="/sys/class/net/$1"
[ ! -e "$dpath" ] && err device $dpath not found
path=`udevadm info --query=path --path="$dpath" | sed -n 's/.*usb/usb/p'`
[ "$path" = "" ] && err unable to get path for $dpath
log "PATH=$path"
usb="`echo $path | sed 's?/.*??'`"
[ "$usb" = "" ] && err unable to get usb path from $path
log "USB=$usb"
busport="`echo $path | sed s?$usb/?? | sed 's?/.*??'`"
[ "$busport" = "" ] && err unable to get bus and port from $path
log "busport=$busport"
usbbase="/sys/bus/usb/devices/$usb"
log "base=$usbbase"
[ ! -d "$usbbase" ] && err $usbbase not found
config="`cat $usbbase/bConfigurationValue`"
log "config=$config"
[ "$config" = "" ] && err unable to read config from $usbbase
busnum="`cat $usbbase/busnum`"
[ "$busnum" = "" ] && err unable to read busnum from $usbbase
log "busnum=$busnum"
mbp="`echo $busport | sed 's/\(.*\)-\(.*\)/usb\1-port\2/'`"
log "mbp=$mbp"

#/sys/bus/usb/devices/%s-0:%d.0/usb%s-port%i/disable
dpath="/sys/bus/usb/devices/$busnum-0:$config.0/$mbp/disable"
log "dpath=$dpath"
[ ! -f "$dpath" ] && err "$dpath not found, cannot restart"
[ "$2" != "restart" ] && exit 0
log "disable $dpath"
echo 1 > "$dpath"
sleep 1
log enable "$dpath"
echo 0 > "$dpath"

