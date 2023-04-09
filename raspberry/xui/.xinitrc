xset s noblank
xset s off
xset -dpms
pdir=`dirname $0`
includeDir="$pdir/.xinitrc.d"
runIncludes(){
  [ ! -d "$includeDir" ] && return
  for include in `find "$includeDir" -name "${1}*"`
  do
    . "$include"
  done
}

CFG=/boot/avnav.conf
[ -f $CFG ] && . $CFG
runIncludes early
[ "$AVNAV_DPI" = "" ] && AVNAV_DPI=96
if [ "$AVNAV_DPI" != "" ] ; then
  xrandr --dpi $AVNAV_DPI
  xrdb -merge <<XX
Xft.dpi: $AVNAV_DPI
XX

fi
#at-spi2 for firefox
ACCESSIBILITY_ENABLED=1
export ACCESSIBILITY_ENABLED
GNOME_ACCESSIBILITY=1
export GNOME_ACCESSIBILITY
MOZ_USE_XINPUT2=1
export MOZ_USE_XINPUT2
if [ "$AVNAV_KEYBOARD" != "" ] ; then
  setxkbmap $AVNAV_KEYBOARD
  current=$AVNAV_KEYBOARD
else
  #gtk3 will only give us the correct initial kb map if set via setxkbmap
  current=`localectl | sed -n 's/ *X11 Layout: *//p'`
  setxkbmap $current
fi
kbf="keyboard-"`echo $current | tr -cd '[a-zA-Z0-9]'`.desktop
kbf="$pdir/.config/xfce4/keyboard-change/$kbf"
if [ ! -f "$kbf" ] ; then
  #ensure that we always can switch to the keyboard we have now
  echo '[Desktop Entry]' > $kbf
  echo 'Type=Settings' >> $kbf
  echo 'Name='$current >>$kbf 
  echo 'Path=/usr/lib' >> $kbf
  echo 'Exec=setxkbmap '$current >> $kbf
fi
#set n mm keyboard height for onboard
keyRows=5
keyHeight="$AVNAV_KEYHEIGHT"
if [ "$keyHeight" = "" ] ; then
  keyHeight=7
fi
#key size for onboard
dockHeight=`echo "scale=0;($AVNAV_DPI * $keyHeight * $keyRows / 25.4)" | bc -l`
gsettings set org.onboard.window.landscape dock-height $dockHeight
#font for openbox
sz=`echo "scale=0;12*$AVNAV_DPI/166" | bc -l`
[ "$sz" -lt 8 ] && sz=8
sed -i  "s?<size> *[0-9]* *</size>?<size>$sz</size>?" $pdir/.config/openbox/rc.xml
runIncludes late
dbus-launch --exit-with-session openbox-session

