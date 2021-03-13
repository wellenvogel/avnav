#! /bin/bash
#AvNav raspberry startup checks
#set -x
CONFIG=/boot/avnav.conf
LAST=/etc/avnav-startup-checks
MCS_INSTALL=`dirname $0`/mcs.sh
log(){
    logger -t 'avnav-startup-check' "$*"
}

log "started"

LAST_PASSWD=""
LAST_MCS=""

if [ -f $LAST ] ; then
    source $LAST
fi    


if [ ! -f $CONFIG ]; then
    log "no $CONFIG found"
    exit 0
fi
source <(tr -d '\015' < $CONFIG)
hasChanges=0
if [ "$AVNAV_PASSWD" != "" ] ; then
    if [ "$AVNAV_PASSWD" = "$LAST_PASSWD" ] ; then
        log "AVNAV_PASSWD is set but unchanged"
    else
        log "setting AVNAV_PASSWD from $CONFIG"
        usermod -p "$AVNAV_PASSWD" pi
        if [ $? = 0 ] ; then
            LAST_PASSWD="$AVNAV_PASSWD"
            hasChanges=1
        else
            log "ERROR: unable to set password, trying on next start"
        fi
    fi
else
    log "AVNAV_PASSWD not set"
fi

runMcs=0
if [ "$AVNAV_MCS" = "yes" ] ; then
    if [ "$LAST_MCS" = "yes" ] ; then
        log "AVNAV_MCS is set but unchanged"
    else
        log "AVNAV_MCS is set to $AVNAV_MCS"
        if [ -f "$MCS_INSTALL" ] ; then
            LAST_MCS="$AVNAV_MCS"
            runMcs=1
            hasChanges=1
        else
            log "ERROR: $MCS_INSTALL not found, cannot set up MCS"
        fi
    fi
else
    log "AVNAV_MCS not enabled"    
fi

needsReboot=0
if [ "$runMcs" = 1 ];then
    log "running $MCS_INSTALL"
    $MCS_INSTALL -r -p -c
    rt=$?
    log "mcs install returned $rt"
    if [ $rt = 1 ] ; then
        log "reboot requested by MCS install"
        needsReboot=1
    else
    [ $rt != 0 ] && LAST_MCS='' #retry next time    
    fi
else
    log "startup check done"    
fi
if [ "$hasChanges" = 1 ]; then
    log "writing back $LAST"
    echo "LAST_MCS=$LAST_MCS" > $LAST
    echo "LAST_PASSWD='$LAST_PASSWD'" >> $LAST
    chmod 600 $LAST
fi
if [ $needsReboot = 1 ] ; then
    log "****rebooting now****"
    reboot
fi
exit 0    



