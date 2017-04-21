
- sh2mda.py Translate Sense Hat sensoren to NMEA's MDA sentence
- sh2xdr.py Translate Sense Hat sensoren to NMEA's XDR sentence


## Installation: ##
    sudo gdebi python-nmea2_1.7.1-1.all.deb
    sudo aptitude install sense-hat
    
## Usage: ##

    sh2MDA.py | nc -u 127.0.0.1 34667
or


    sh2XDR.py | nc -u 127.0.0.1 34667
