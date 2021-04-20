#! /bin/sh
sudo -n date -u "$*" || exit 1
if [ $(sudo systemctl is-enabled ntp) != "masked" ]
then
  sudo -n systemctl mask ntp
fi
sudo -n /sbin/fake-hwclock save force
sudo -n systemctl restart fake-hwclock
#we must restart avahi as otherwise it will not respond any more
sudo -n systemctl try-restart avahi-daemon
exit 0
