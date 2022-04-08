#! /bin/sh
#play a sound with setting the volume before
set -x
if [ "$1" = "-i" ] ; then
  shift
  intf="$1"
  shift
  amixer -D $intf cset numid=1 $1
  mpg123 -q -a $intf $2
else
  amixer  cset numid=1 $1
  mpg123 -q $2
fi
