#! /bin/sh
ETC_TEMPLATE=/etc/avnav_server.xml
TEMPLATE=`dirname $0`/avnav_server.xml
DATA_DIR=/home/pi/avnav/data
CONFIG=$DATA_DIR/avnav_server.xml
USER=pi:pi

[ -f $CONFIG ] && exit 0
[ ! -f "$ETC_TEMPLATE" ] && exit 0
echo "using $ETC_TEMPLATE as initial avnav config"
if [ ! -d "$DATA_DIR" ] ; then
    mkdir -p "$DATA_DIR"    
fi
cp "$ETC_TEMPLATE" "$CONFIG" || exit 1
chown -R $USER `dirname $DATA_DIR`
chmod -R u+w `dirname $DATA_DIR`
