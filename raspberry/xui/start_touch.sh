#! /bin/sh
CFG=/boot/avnav.conf
[ -f $CFG ] && . $CFG

X=/usr/lib/xorg/Xorg
if [ "$1" = "prepare" ] ; then
  logger -t avnavstartx preparing
  echo "running prepare"
  if [ "$AVNAV_STARTX" != "yes" ] ; then
    exit 0
  fi
  if [ ! -f "$X" ] ; then
    echo "$X not found, cannot start UI"
    exit 1
  fi
  rm -f /tmp/.X0-lock
  rm -f /tmp/.X11-unix/X0
  #workaround for modeset errors
  chmod u+s $X
  #tty
  chmod g+w /dev/tty
  #TODO: postinstall?
  usermod -a -G tty pi
  update-menus
  exit 0
fi

if [ "$AVNAV_STARTX" != "yes" ] ; then
  echo "starting UI disabled in $CFG"
  while [ "$AVNAV_STARTX" != "yes" ] ; do
    sleep 5
  done
fi
exec startx
