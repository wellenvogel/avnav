#! /bin/sh
pdir=`dirname $0`
HOME=/home/pi

[ ! -d "$HOME" ] && err "$HOME not found"

err(){
    echo "ERROR: $*"
    exit 1
}

copyErr(){
    echo "copying $1 $2"
    cp "$1" "$2" || err "unable to copy $1 to $2"
}

copyNE(){
    if [ ! -f $1/$2 ] ; then
        cp $pdir/$2 $1/$2
    fi
}

pinFile=libgtk-3-0-pin
reinstalls=""
if [ -f "$pdir/$pinFile" ] ; then
    copyErr "$pdir/$pinFile" /etc/apt/preferences.d
    reinstalls="libgtk-3-0 libgail-3-0"
fi

echo "stopping avnav..."
systemctl stop avnav
echo "setting system time..."
ntpdate pool.ntp.org || err "unable to set system time"
echo "wating 5s"
sleep 5

apt-get update
if [ $? != 0 ] ; then
  echo "apt-get update failed, waiting 5s and trying again"
  sleep 5
  apt-get update
fi

if [ "$reinstalls" != "" ] ; then
    apt-get install --reinstall -y --allow-downgrades $reinstalls
fi
apt-get install python-xdg || apt-get install python3-xdg || err "unable to install"
apt-get install -y --no-install-recommends xserver-xorg-video-all \
  xserver-xorg-input-all xserver-xorg-core xinit x11-xserver-utils \
  onboard  at-spi2-core onboard-data mousetweaks gir1.2-ayatanaappindicator3-0.1 gir1.2-atspi-2.0 \
  openbox lxterminal dconf-cli firefox-esr dbus-x11 python3-xlib \
  nemo xfce4-panel mousepad xdotool menu libglib2.0-bin || err "unable to install"

copyNE /boot avnav.conf 
cp $pdir/avnav-startx.service /etc/systemd/system || err
systemctl daemon-reload

cfg="$HOME/.config"
if [ ! -d "$cfg" ] ; then
    mkdir -p $cfg || err
fi
cp -r $pdir/config/* $cfg || err "unable to copy config"
chown -R pi:pi $cfg

copyErr $pdir/.xinitrc $HOME 
chown pi:pi $HOME/.xinitrc

copyErr $pdir/Xwrapper.config /etc/X11 


cp $pdir/onboard.conf "$HOME"
chown pi:pi "$HOME/onboard.conf"

#set up config settings
DBASE=/etc/dconf
dp="$DBASE/profile"
if [ ! -d "$dp" ] ; then
    mkdir -p "$dp" || err "unable to create $dp"
fi
copyErr "$pdir/dconf-user" "$dp/user"
dd="$DBASE/db/local.d"
if [ ! -d "$dd" ]; then
    mkdir -p "$dd" || err "unable to create $dd"
fi
copyErr "$pdir/dconf-onboard.conf" $dd

dconf update || err "unable to set up dconf"

if [ -d $HOME/.cache ] ; then
    chown -R pi:pi $HOME/.cache
fi

systemctl enable avnav-startx

echo "setup done, use systemctl start avnav-startx after editing /boot/avnav.conf"
echo "use sudo systemctl start avnav to start the avnav server if you don't reboot"




  
