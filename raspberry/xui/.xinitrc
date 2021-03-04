xset s noblank
xset s off
xset -dpms

CFG=/boot/avnav.conf
[ -f $CFG ] && . $CFG

if [ "$AVNAV_DPI" != "" ] ; then
  xrandr --dpi $AVNAV_DPI
  xrdb -merge <<XX
Xft.dpi: $AVNAV_DPI
XX

fi
MOZ_USE_XINPUT2=1
export MOZ_USE_XINPUT2
if [ "$AVNAV_KEYBOARD" != "" ] ; then
  setxkbmap $AVNAV_KEYBOARD
fi
dconf load /org/onboard/ < /home/pi/onboard.conf
dbus-launch --exit-with-session openbox-session

