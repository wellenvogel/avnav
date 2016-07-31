Preparations to run on ubuntu/debian
------------------------------------
Install the package
sudo dpkg -i avnav.deb #there will be complains about missing dependencies
sudo apt-get install -f #install missing dependencies

Running test nmea-generator (only if you cloned the git repo):
cd test
./socketserver.py 34568 nmea-20130630.log 0.2

Running:
as arbitrary user:
avnav [-d] [-q] [-b basedir] [-c chartdir] [-x cfgfile] [-g}
This will create a directory ~/avnav (if you do not provide -b) and create a avnav_server.xml from a template.

as a service:
This will run avnav with the user avnav (for raspberry see there).
The data directory will be /var/lib/avnav.
sudo systemctl start avnav
To start it automatically on boot:
sudo systemctl enable avnav




