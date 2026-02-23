#! /bin/sh
# start dhclient when wpa connects, stop when it disconnects

logger -t 'avnav-wpa' $1 $2
if [ "$2" = "CONNECTED" ] ; then
	dhclient -nw -e IF_METRIC=10 $1 
fi
if [ "$2" = "DISCONNECTED" ] ; then
	dhclient -x $1 
fi
