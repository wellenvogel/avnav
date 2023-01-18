#! /bin/sh
if [ "$1" != "" ] ; then
sudo -n date -u "$*" || exit 1
fi
if [ $(sudo systemctl is-enabled ntp) != "masked" ]
then
  sudo -n systemctl mask ntp
fi
sudo -n /sbin/fake-hwclock save force
sudo -n systemctl restart fake-hwclock
#we must restart avahi as otherwise it will not respond any more
sudo -n systemctl try-restart avahi-daemon
(echo restart wlan-av1; sudo ifdown wlan-av1; sleep 10; echo start wlan-av1;sudo ifup wlan-av1) &
exit 0
