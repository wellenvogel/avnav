#! /bin/sh
ETC_TEMPLATE=/etc/avnav_server.xml
TEMPLATE=`dirname $0`/avnav_server.xml
DATA_DIR=/home/pi/avnav/data
CONFIG=$DATA_DIR/avnav_server.xml
CFG=/etc/default/avnav
USER=pi:pi
if [ ! -f $CONFIG -a -f "$ETC_TEMPLATE" ] ; then
    echo "using $ETC_TEMPLATE as initial avnav config"
    if [ ! -d "$DATA_DIR" ] ; then
        mkdir -p "$DATA_DIR"    
    fi
    cp "$ETC_TEMPLATE" "$CONFIG" || exit 1
    chown -R $USER `dirname $DATA_DIR`
    chmod -R u+w `dirname $DATA_DIR`
fi
#some check for canboat rust
if [ ! -x /usr/bin/canboat -a -x /usr/bin/n2kd ] ; then
  if [ -f $CFG ] ; then
    if ! grep -q '^AVNAV_LEGACY_CANBOAT' $CFG ; then
      echo "AVNAV_LEGACY_CANBOAT=1" >> $CFG
      echo "export AVNAV_LEGACY_CANBOAT" >> $CFG
    else
      sed -i 's/^AVNAV_LEGACY_CANBOAT.*/AVNAV_LEGACY_CANBOAT=1/' $CFG
    fi
  else
    echo "AVNAV_LEGACY_CANBOAT=1" >> $CFG
    echo "export AVNAV_LEGACY_CANBOAT" >> $CFG
  fi
else
  if [ -f $CFG ] ; then
    if grep -q '^AVNAV_LEGACY_CANBOAT' $CFG ; then
      sed -i '/AVNAV_LEGACY_CANBOAT/d' $CFG
    fi
  fi
fi
