#! /bin/sh
cd `dirname $0`
../server/avnav_server.py $* avnav_server.xml
echo done

