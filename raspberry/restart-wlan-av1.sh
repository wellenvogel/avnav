#! /bin/sh
# workaround for broken 8192cu driver in stretch
# see https://raspberrypi.stackexchange.com/questions/88137/unable-to-switch-wifi-networks-using-usb-dongle-on-raspbian-stretch
# will be called whenever we connect to a WLAN if configured as restartWlan command
# this of course alos could drop your access point if you run this with an USB adapter
# so you need to decide whether to configure it or not
# hopefully there will be a correction in the future

lsmod | grep 8192cu > /dev/null 2>&1 || exit 0
logger -t avnav-restart-wlan-av1 restarting 8192cu driver
ifdown wlan-av1
rmmod 8192cu
modprobe 8192cu
ifup wlan-av1
