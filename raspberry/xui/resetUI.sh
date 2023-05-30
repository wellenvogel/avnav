#! /bin/bash
PROFILE=/home/pi/.mozilla/firefox/avnav
DELETE_MARKER=AVNAV_DELETE
if [ -d "$PROFILE" ] ; then
    echo "preparing deletion of $PROFILE"
    touch "$PROFILE/$DELETE_MARKER"
    if [ $? != 0 ] ; then
      echo "unable to write $PROFILE/$DELETE_MARKER"
      exit 1
    fi
fi
sudo -n systemctl restart avnav-startx