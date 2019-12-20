#! /bin/sh
sudo -n date -u "$*" || exit 1
sudo -n systemctl mask ntp
sudo -n /sbin/fake-hwclock save force
sudo -n systemctl restart fake-hwclock
