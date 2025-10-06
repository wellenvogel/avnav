#! /bin/sh
err(){
    echo "ERROR: $*"
    exit 1
}
pdir=`dirname $0`
if [ -d /boot/firmware ]
then
  CFG=/boot/firmware/avnav.conf
else
  CFG=/boot/avnav.conf
fi
[ -f $CFG ] && . $CFG
pluginDir="$pdir/../../server/plugins/switchDesk"    
if [ "$AVNAV_STARTX" != "yes" ] ; then
  logger -t avnav remove switchdesk
  rm -rf "$pluginDir"
else
  logger -t avnav prepare switchdesk
  if [ ! -d "$pluginDir" ] ; then
    mkdir -p "$pluginDir" || err "unable to create $pluginDir"
  fi
  for f in plugin.py switch_desk.sh
  do
    cp "$pdir/$f" "$pluginDir/$f"
  done
  cp "$pdir/../../viewer/images/rpi.png" "$pluginDir"
fi
exit 0
