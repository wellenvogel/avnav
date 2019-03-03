* Enable serial reader for /dev/ttyS0 at 9600 baud
* remove all serial stuff from /boot/cmdline.txt
* add a static interface at 192.168.80.10 to eth0:
    /etc/network/interfaces.d/eth0 add:
    auto eth0:0
    iface eth0:0 inet static
    address 192.168.80.10
    netmask 255.255.255.0
    broadcast 192.168.80.255
