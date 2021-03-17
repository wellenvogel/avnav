#! /bin/sh
#play a sound with setting the volume before
amixer -D hw:1 cset numid=1 $1
mpg123 -q -a hw:1 $2
