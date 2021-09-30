#! /bin/sh
retry=1
trapf(){
  retry=0
}
trap trapf 0 1 2 3 4 5 6 7 8 15 
wine /home/andreas/nmeasim/NMEA_Simulator.exe &
sleep 5
while [ "$retry" = 1 ]
do
  echo forward com1 to udp localhost 34667
  socat PTY,link=/home/andreas/.wine/dosdevices/com1,raw udp:localhost:34667
done
