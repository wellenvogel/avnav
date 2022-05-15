#! /bin/sh
usage(){
	echo "usage: $0 4800 /dev/serial/by-path/..."
}
if [ "$1" = "" -o "$2" = "" ] ; then
	usage
	exit 1
fi
if [ ! -e "$2" ] ; then
	echo "path $2 not found"
	exit 1
fi
host=127.0.0.1
if [ "$3" != "" ] ; then
  host=$3
fi
while true
do
	stty raw < $2
	stty speed $1 < $2
	sed -u 's/\*.*//' < $2 | nc -w3 -u $host 34667
done



