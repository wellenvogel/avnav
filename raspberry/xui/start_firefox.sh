#! /bin/sh
USER=pi
HOME=/home/$USER
PROFILE=$HOME/.mozilla/firefox/avnav
set -x
dbus-monitor --address "$DBUS_SESSION_BUS_ADDRESS" > /dev/null 2>&1 &
monitor=$!
while true
do
 if [ ! -d "$PROFILE" ] ; then
   echo "profile $PROFILE not found, creating it"
   mkdir -p $PROFILE && cp -rp /usr/lib/avnav/raspberry/xui/firefox-profile/* $PROFILE
 fi 
 MOZ_USE_XINPUT2=1 firefox --profile $PROFILE --class=AvNavFirefox 'http://localhost:8080/viewer/avnav_viewer.html?fullscreen=server:desk2'
 kill -0 $monitor || exit 0
 sleep 1
done

