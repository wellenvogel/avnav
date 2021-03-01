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

#from avnav touch 
#https://gitlab.open-mind.space/pandel/avnavtouch/-/blob/master/etc/X11/openbox/autostart


dconf load /org/onboard/ < /home/pi/onboard.conf
dbus-launch --exit-with-session openbox-session

