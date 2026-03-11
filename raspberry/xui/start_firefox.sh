#! /bin/sh
USER=pi
HOME=/home/$USER
PROFILE=$HOME/.mozilla/firefox/avnav
DELETE_MARKER=AVNAV_DELETE
#set -x
dbus-monitor --address "$DBUS_SESSION_BUS_ADDRESS" > /dev/null 2>&1 &
monitor=$!
panelPid=""
while true
do
 if [ -f "$PROFILE/$DELETE_MARKER" ] ; then
   echo "delete marker found, removing $PROFILE"
   rm -rf "$PROFILE"
 fi
 if [ ! -d "$PROFILE" ] ; then
   echo "profile $PROFILE not found, creating it"
   mkdir -p $PROFILE && cp -rp /usr/lib/avnav/raspberry/xui/firefox-profile/* $PROFILE
 else
  rm -f "$PROFILE/.parentlock"  
  rm -f "$PROFILE/lock"  
 fi
 if [ "$panelPid" != "" ] ; then
   kill $panelPid
   panelPid=""
 fi 
 #we assume that we maybe have a nice dimm command available on the server
 MOZ_USE_XINPUT2=1 firefox --profile $PROFILE --class=AvNavFirefox 'http://localhost:8080/viewer/avnav_viewer.html?fullscreen=server:desk2&dimm=server:dimm&defaultSettings=.*localFirefox' &
 ffpid=$!
 echo "ffpid=$ffpid"
 panelSize=""
 if [ "$AVNAV_FFPANEL_WIDTH" != "" ] ; then
   panelSize="-s $AVNAV_FFPANEL_WIDTH"
 fi
 `dirname $0`/FFPanel.py -c AvNavFirefox -p $ffpid $panelSize &
 panelPid=$!
 wait $ffpid
 kill -0 $monitor || exit 0
 sleep 1
done

