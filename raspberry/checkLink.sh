#! /bin/sh
# a helper script for the somehow broken ethernet driver on a pi3+
# this driver is unable to correctly detect reconnects of the ethernet cable
# the script will check the link status using ethtool every 2 seconds
# and if it detects no carrier after 5 tries it will try to bring up the link again
# using ip link set xx down/up
# when it has detected the link being down and it comes up afterwards it will restart
# the dhclient for this link
# to enable this script add the following line to /etc/rc.local (at the end)
# omit the # at the beginning
# /usr/lib/avnav/raspberry/checkLink.sh &

#set -x
dev=eth0
count=0
down=0
if [ "$1" != "" ] ; then
  dev=$1
fi
uid=`id -u`
cmd="sudo -n"
if [ "$uid" = "0" ] ; then
  cmd=""
fi
while true
do
  sleep 2
  stat=`ethtool eth0 2> /dev/null | sed -n 's/.*Link detected *: *//p'`
  if [ "$stat" = "no" ] ; then
    count=`expr $count + 1`
    if [ "$count" -gt 5 ] ; then
      down=1
      $cmd ip link set $dev down && sleep 3 && sudo -n ip link set $dev up
      count=0
    fi
  else
    count=0
    if [ "$down" = 1 ] ; then
      down=0
      $cmd logger -t checkLink "restarting $dev"
      $cmd systemctl restart ifup@$dev
    fi
  fi

done
