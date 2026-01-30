#! /bin/bash
CAT="avnav-set-hotspot"
CFG=/boot/firmware/avnav.conf
NWCFG=/etc/NetworkManager/system-connections/Hotspot.nmconnection
TMP="$NWCFG.tmp"
log(){
    logger -t $CAT $*
}
err(){
    log "ERROR: "$*
    rm -f "$TMP"
    exit 1
}
if [ ! -f "$CFG" ] ; then
  log $CFG not found, no action
  exit 0
fi
if [ ! -f "$NWCFG" ] ; then
  log $NWCFG not found
  exit 0
fi
[ -f "$TMP" ] && rm -f "$TMP"
. "$CFG"
cp "$NWCFG" "$TMP" || err "unable to copy $NWCFG to $TMP"
if [ "$AVNAV_SSID" != "" ] ; then
  sed "s/^ *ssid *=/ssid=$AVNAV_SSID/" -i "$TMP" || err "unable to set SSID $AVNAV_SSID in $TMP"
  log "setting ssid to $AVNAV_SSID"
fi
if [ "$AVNAV_PSK" != "" ] ; then
  sed "s/^ *psk *=/psk=$AVNAV_PSK/" -i "$TMP" || err "unable to set PSK <...> in $TMP"
  log "setting psk" 
fi
if [ "$AVNAV_WIFI_APIF" != "" ] ; then
  sed "s/^ *interface-name *=/interface-name=$AVNAV_WIFI_APIF/" -i "$TMP" || err "unable to set interface-name $AVNAV_WIFI_APIF in $TMP"
  log "setting interface-name to $AVNAV_WIFI_APIF"
fi
diff "$NWCFG" "$TMP" > /dev/null
if [ $? = 0 ] ; then
  log "no change in config $NWCFG"
else
  log "config $NWCFG changed"
  SV="$NWCFG.save"
  rm -f "$SV"
  mv "$NWCFG" "$SV" || err "unable to rename $NWCFG to $SV" 
  mv "$TMP" "$NWCFG"
  if [ $? != 0 ] ; then
    #try to recover
    mv "$SV" "$NWCFG" || err "unable to modify $NWCFG, unable to recover"
    err "unable to change $NWCFG, falling back"
  else
    log "updated $NWCFG"
  fi
fi
exit 0
