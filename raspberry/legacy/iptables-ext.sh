#! /bin/sh
# script to allow/deny the external access to an interface (if already configured)
# it relies on the basic iptable set up to already have a rule for the interface
# otherwise it will insert a deny rule as the second rule in the input chain

DEFAULT_INSERT=2
if [ "$1" = "" -o "$2" = "" ] ; then
	echo "usage: $0 interface allow|deny"
	exit 1
fi
mode="REJECT --reject-with icmp-port-unreachable"
old=ACCEPT
new=REJECT
if [ "$2" = "allow" ] ; then
	mode=ACCEPT
	old=REJECT
	new=ACCEPT
fi
current=`iptables -L INPUT -v --line-numbers | grep -e "$old.*$1" | head -1 | sed -n 's/ .*//p'`
if [ "$current" = "" ] ; then
	if [ "$new" = "ACCEPT" ] ; then
		echo "no entry with $old $1 found, no action"
		exit 0
	fi
	echo "inserting $1 to $mode"
	iptables -I INPUT $DEFAULT_INSERT -i $1 -j $mode

else 
	echo "changing mode for $1 to $mode"
	iptables -R INPUT $current  -i $1 -j $mode
fi 
new_num=`iptables -L INPUT -v --line-numbers | grep -e "$new.*$1" | head -1 | sed -n 's/ .*//p'`
if [ "$new_num" = "" ] ; then
	echo "unable to set $mode for $1"
	exit 1
else
	echo "successfully set $new for $1"
fi
