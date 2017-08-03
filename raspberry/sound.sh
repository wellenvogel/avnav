#! /bin/sh
#play a sound with setting the volume before
amixer set PCM,0 $1
mpg123 -q $2
