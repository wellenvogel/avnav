#! /bin/bash
#AvNav raspberry startup checks
#set -x
CONFIG=/boot/avnav.conf
LAST=/etc/avnav-startup-checks
MCS_INSTALL=`dirname $0`/setup-mcs.sh
log(){
    logger -t 'avnav-startup-check' "$*"
}

log "started"

LAST_PASSWD=""
LAST_MCS=""
LAST_WIFI_CLIENT=""

if [ -f $LAST ] ; then
    source $LAST
fi    


if [ ! -f $CONFIG ]; then
    log "no $CONFIG found"
    exit 0
fi
source <(tr -d '\015' < $CONFIG)
hasChanges=0
needsReboot=0
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

if [ "$AVNAV_WIFI_CLIENT" != "$LAST_WIFI_CLIENT" ] ; then
    log "AVNAV_WIFI_CLIENT=$AVNAV_WIFI_CLIENT"
    hasChanges=1
    needsReboot=1
    LAST_WIFI_CLIENT="$AVNAV_WIFI_CLIENT"
else
    log "AVNAV_WIFI_CLIENT unchanged"
fi

if [ "$AVNAV_HOSTNAME" != "$LAST_HOSTNAME" -a "$AVNAV_HOSTNAME" != "" ] ; then
    log "AVNAV_HOSTNAME is set to $AVNAV_HOSTNAME"
    current=`cat /etc/hostname | tr -d " \t\n\r"`
    if [ "$current" = "$AVNAV_HOSTNAME" ]; then
        log "hostname already correctly set in /etc/hostname"
    else
        echo "$AVNAV_HOSTNAME" > /etc/hostname
        sed -i "s/127.0.1.1.*$current/127.0.1.1\t$AVNAV_HOSTNAME/g" /etc/hosts
        needsReboot=1
    fi
    hasChanges=1
    LAST_HOSTNAME="$AVNAV_HOSTNAME"
else
    log "AVNAV_HOSTNAME unchanged"
fi

if [ "$AVNAV_KBLAYOUT" != "$LAST_KBLAYOUT" -o "$AVNAV_KBMODEL" != "$LAST_KBMODEL" ] ; then
    if [ "$AVNAV_KBLAYOUT" != "" -a "$AVNAV_KBMODEL" != "" ]; then
        log "AVNAV_KBLAYOUT=$AVNAV_KBLAYOUT, AVNAV_KBMODEL=$AVNAV_KBMODEL"
        kbfile=/etc/default/keyboard
        currentModel=`sed -n 's/^ *XKBMODEL *= *//p' $kbfile | tr -d '" \n\r'`
        currentLayout=`sed -n 's/^ *XKBLAYOUT *= *//p' $kbfile | tr -d '" \n\r'`
        if [ "$currentLayout" = "$AVNAV_KBLAYOUT" -a "$currentModel" = "$AVNAV_KBMODEL" ] ; then
            log "keyboard already correctly set up in system"
        else
            log "set up keyboard"
            hasChanges=1
            echo "XKBMODEL=\"$AVNAV_KBMODEL\"" > $kbfile
            echo "XKBLAYOUT=\"$AVNAV_KBLAYOUT\"" >> $kbfile
            echo "XKBVARIANT=\"\"" >> $kbfile
            echo "XKBOPTIONS=\"\"" >> $kbfile
            dpkg-reconfigure -f noninteractive keyboard-configuration
        fi
        hasChanges=1
        LAST_KBLAYOUT="$AVNAV_KBLAYOUT"
        LAST_KBMODEL="$AVNAV_KBMODEL"
    fi    
else
    log "AVNAV_KBLAYOUT and AVNAV_KBMODEL unchanged"
fi

if [ "$AVNAV_TIMEZONE" != "$LAST_TIMEZONE" -a "$AVNAV_TIMEZONE" != "" ] ; then
    log "AVNAV_TIMEZONE is set to $AVNAV_TIMEZONE"
    currentTZ=`cat /etc/timezone | tr -d " \t\n\r"`
    if [ "$currentTZ" = "$AVNAV_TIMEZONE" ] ; then
        log "timezone already correctly set in system"
    else
        log "change time zone"
        rm -f /etc/localtime
        needsReboot=1
        echo "$AVNAV_TIMEZONE" > /etc/timezone
        dpkg-reconfigure -f noninteractive tzdata
    fi
    hasChanges=1
    LAST_TIMEZONE="$AVNAV_TIMEZONE"
else
    log "timezone unchanged"
fi

if [ "$AVNAV_WIFI_COUNTRY" != "$LAST_WIFI_COUNTRY" -a "$AVNAV_WIFI_COUNTRY" != "" ]; then
    log "AVNAV_WIFI_COUNTRY changed to $AVNAV_WIFI_COUNTRY"
    cfgfile=/etc/wpa_supplicant/wpa_supplicant.conf
    current=`sed -n 's/^ *country *= *//p' $cfgfile | sed 's/#.*//'| tr -d '" \n\r'`
    if [ "$current" = "$AVNAV_WIFI_COUNTRY" ] ; then
        log "AVNAV_WIFI_COUNTRY already correctly set in system"
    else
        if [ "$current" != "" ] ; then
            sed -i "s/^ *country *=.*/country=$AVNAV_WIFI_COUNTRY/" $cfgfile
        else
            echo "" >> $cfgfile
            echo "country=$AVNAV_WIFI_COUNTRY" >> $cfgfile
        fi
        needsReboot=1
    fi
    hasChanges=1
    LAST_WIFI_COUNTRY="$AVNAV_WIFI_COUNTRY"
else
    log "AVNAV_WIFI_COUNTRY unchanged"
fi

runMcs=0
if [ "$AVNAV_MCS" = "yes" ] ; then
    if grep MCS_DO_NOT_DELETE /etc/modules > /dev/null 2>&1 ; then
        log "must correct /etc/modules"
        LAST_MCS=""
    fi
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
    echo "LAST_WIFI_CLIENT='$LAST_WIFI_CLIENT'" >> $LAST
    echo "LAST_HOSTNAME='$LAST_HOSTNAME'" >> $LAST
    echo "LAST_KBLAYOUT='$LAST_KBLAYOUT'" >> $LAST
    echo "LAST_KBMODEL='$LAST_KBMODEL'" >> $LAST
    echo "LAST_TIMEZONE='$LAST_TIMEZONE'" >> $LAST
    echo "LAST_WIFI_COUNTRY='$LAST_WIFI_COUNTRY'" >> $LAST
    chmod 600 $LAST
fi
if [ $needsReboot = 1 ] ; then
    echo "****rebooting now****"
    log "****rebooting now****"
    if [ "$1" = "noreboot" ] ; then
        exit 2
    fi
    reboot
fi
exit 0    



