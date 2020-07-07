Minimalistic Hardware Setup for AvNav
=====================================

This directory describes a very minimal hardware set up for a raspberry pi running AvNav.
It uses an NeoUBlox6 module as a GPS receiver and a LM2596 module for a power supply.

To handle alarms locally a (piezo) buzzer is connected together with a push button to clear the alarm and a switch to disable the buzzer sound.

Buzzer control is done with a small [shell script](sound2.sh). The script must be copied to /home/pi/avnav.

To control the gpio pins in the shell script the [wiringpi](http://wiringpi.com/) library is used, so you need to install it with

```sudo apt-get install wiringpi```

The switch is queried within the shell script to disable the buzzer. Just take care for the buzzer to not consume more then 16mA (the max pin output current).

To allow AvNav to use the serial port (that is connected to the Ublox module) you need to remove the console connection to _/dev/ttyS0_ from _/boot/cmdline.txt_ (see [the description](https://elinux.org/RPi_Serial_Connection)).
If you are running one of our [headless images](https://www.wellenvogel.net/software/avnav/docs/install.html#Headless) a nice script is included to help you in setting things up:

```
sudo ./uart_control status 
sudo ./uart_control gpio
```


The [avnav_server.xml](avnav_server.xml) has to be adapted to use the push button for alarm clearing, the [sound2.sh](sound2.sh) script for some of the alarm sounds and the serial interface _/dev/ttyS0_ as input.


Example Shopping List
---------------------
* [Raspberry Pi 3](https://www.reichelt.de/raspberry-pi-3-b-4x-1-2-ghz-1-gb-ram-wlan-bt-raspberry-pi-3-p164977.html)
* [LM2596 Module](https://www.makershop.de/module/step-downup/lm2596-step-down/)
* [UBlox Neo6 Module](https://www.amazon.de/AZDelivery-NEO-6M-GPS-baugleich-u-blox/dp/B01N38EMBF/)
* Buzzer
* Switch
* Push Button
* Jumperkabel 
