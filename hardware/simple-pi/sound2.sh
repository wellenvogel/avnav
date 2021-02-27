#! /bin/sh
#set -x


BEEP=22
ENABLE=27

trapfkt(){
        echo trap
	gpio -g write $BEEP 0
	exit 1
}

trap trapfkt 0 5 6 7 8 15 13 14 19

beep(){
        trap trapfkt 5 6 7 8 15 13 14 19
	num=10
	while [ $num -gt 0 ] ; do
		gpio -g write $1 1
		sleep 1
		gpio -g write $1 0
		sleep 1
		en=`gpio -g read $ENABLE`
		[ "$en" = "0" ] || return
		num=`expr $num - 1`
	done
}
gpio -g mode $BEEP out
gpio -g write $BEEP 0
gpio -g mode $ENABLE in up
en=`gpio -g read $ENABLE`
if [ "$en" = "0" ] ; then
  beep $BEEP &
fi
/usr/lib/avnav/raspberry/sound.sh $*

