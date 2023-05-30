#! /bin/bash
PROFILE=/home/pi/.mozilla/firefox/avnav
DELETE_MARKER=AVNAV_DELETE
if [ -d "$PROFILE" ] ; then
    touch "$PROFILE/$DELETE_MARKER"
fi
sudo -n systemctl restart avnav-startx