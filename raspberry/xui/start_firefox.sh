#! /bin/sh
set -x
dbus-monitor --address "$DBUS_SESSION_BUS_ADDRESS" > /dev/null 2>&1 &
monitor=$!
while true
do
 MOZ_USE_XINPUT2=1 firefox --profile /home/pi/.mozilla/firefox/avnav/ --class=AvNavFirefox 'http://localhost:8080?maximize=server'
 kill -0 $monitor || exit 0
 sleep 1
done

