#! /bin/bash
cmd=firewall-offline-cmd
permanent=""
status=`systemctl is-system-running` || true
DEFZONE=trusted
echo "systemd status $status"
if [ "$status" != "offline" ] ; then
  if systemctl --quiet is-active firewalld ; then
    cmd=firewall-cmd
    permanent="--permanent"
  else
    echo "firewalld not running, setting up offline"  
  fi
fi
current="`$cmd --get-default-zone`"
if [ "$current" != "$DEFZONE" ] ; then
  echo "current default zone is $current"
  echo "setting default zone for firewalld to $DEFZONE with $cmd"
  $cmd $permanent --set-default-zone $DEFZONE
else
  echo "firewall default zone already $DEFZONE"
fi
if [ "$1" = "-i" ] ; then
    exit 0
fi
GETPORT=`dirname $0`/../patchServerConfig.py

if [ ! -x "$GETPORT" ] ; then
    echo "$GETPORT not found, unable to set port forward"
    exit 0
fi
CFG1="/home/pi/avnav/data/avnav_server.xml"
CFG2="`dirname $0`/../avnav_server.xml"
if [ -f "$CFG1" ] ; then
    config="$CFG1"
else
    [ -f "$CFG2" ] && config="$CFG2"
fi
if [ "$config" = "" ] ; then
    echo no config $CFG1 or $CFG2 found, unable to set port forwarding
    exit 0
fi
echo reading config $config
port="`$GETPORT -f $config -h AVNHttpServer -p httpPort= | sed 's/httpPort=//'`"
[ "$port" = "" ] && port=8080
echo found http port $port
cfw="`$cmd --zone=$DEFZONE --list-forward-ports | sed -n 's/^port=80:proto=tcp:toport=//p' | sed 's/:.*//'`"
mustSet=1
if [ "$cfw" != "" ] ; then
  if [ "$cfw" = "$port" ] ; then
    echo "port forwarding for port 80 to $port already enabled"
    mustSet=0
  else
    echo remove port forwarding from 80 to $cfw
    $cmd $permanent --zone=$DEFZONE --remove-forward-port=port=80:proto=tcp:toport=$cfw
  fi
fi
if [ "$mustSet" = 1 ] ; then
  echo "set up port forwarding for port 80 to $port"
  $cmd $permanent --zone=$DEFZONE --add-forward-port=port=80:proto=tcp:toport=$port
fi