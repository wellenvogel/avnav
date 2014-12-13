Preparations to run on ubuntu/debian
------------------------------------
If you want to test the server functions
1. add user to dialout group
sudo adduser <myname> dialout
2. install serial,bluetooth,udev
sudo apt-get install python-pyudev
sudo apt-get install python-serial
sudo apt-get install python-bluez


Running test nmea-generator:
cd test
./socketserver.py 34568 nmea-20130630.log 0.2

Running:
cd linux
avnav_gui.py

Or directly:
cd linux
../server/avnav_server.py [-d] avnav_server.xml

Settings when testing serial receive:
stty -icrnl < /dev/ttyUSB1
cat /dev/ttyUSB1


