#! /bin/sh
pdir=`dirname $0`
HOME=/home/pi

[ ! -d "$HOME" ] && err "$HOME not found"

err(){
    echo "ERROR: $*"
    exit 1
}

copyNE(){
    if [ ! -f $1/$2 ] ; then
        cp $pdir/$2 $1/$2
    fi
}

apt-get update
apt-get install -y --no-install-recommends xserver-xorg-video-all \
  xserver-xorg-input-all xserver-xorg-core xinit x11-xserver-utils \
  onboard python-xdg at-spi2-core onboard-data mousetweaks gir1.2-appindicator3-0.1 gir1.2-atspi-2.0 \
  openbox lxterminal dconf-cli firefox-esr dbus-x11 \
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

cp $pdir/.xinitrc $HOME || err "unable to copy .xinitrc"
chown pi:pi $HOME/.xinitrc

cp $pdir/Xwrapper.config /etc/X11 || err "unable to copy X11 wrapper config"

ffprofile="$HOME/.mozilla/firefox/avnav"

if [ ! -d "$ffprofile" ] ; then
    mkdir -p "$ffprofile" || err "unable to create $ffprofile"
fi
cp -r $pdir/firefox-profile/* "$ffprofile"
chown -R pi:pi "$HOME/.mozilla"

cp $pdir/onboard.conf "$HOME"
chown pi:pi "$HOME/onboard.conf"

servercfg="$HOME/avnav/data/avnav_server.xml"
if [ ! -f $servercfg ] ; then
    if [ ! -d "$HOME/avnav/data" ] ; then
        mkdir -p "$HOME/avnav/data"
    fi
    cp $pdir/../avnav_server.xml $servercfg
    chown -R pi:pi "$HOME/avnav"
fi

$pdir/patchServerConfig.py $servercfg desk2 "/usr/lib/avnav/raspberry/xui/switch_desk.sh 2" images/rpi.png || err "unable to patch $servercfg"
chown pi:pi $servercfg


systemctl enable avnav-startx

echo "setup done, use systemctl start avnav-startx after editing /boot/avnav.conf"




  