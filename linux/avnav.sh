#! /bin/sh
cd `dirname $0`
python ../server/avnav_server.py $* avnav_server.xml
echo done

