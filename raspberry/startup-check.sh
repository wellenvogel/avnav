#! /bin/bash
#AvNav raspberry startup checks
#set -x
CONFIG=/boot/avnav.conf
LAST=/etc/avnav-startup-checks
MCS_INSTALL=`dirname $0`/setup-mcs.sh
pdir=`dirname $0`
if [ "$1" != "" ] ; then
  logStdout=1
fi
log(){
    [ "$logStdout" = "1" ] && echo "$*"
    logger -t 'avnav-startup-check' "$*"
}

log "started"
LAST_DATA=()


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
LAST_DATA+=("LAST_PASSWD='$LAST_PASSWD'")

if [ "$AVNAV_WIFI_CLIENT" != "$LAST_WIFI_CLIENT" ] ; then
    log "AVNAV_WIFI_CLIENT=$AVNAV_WIFI_CLIENT"
    hasChanges=1
    needsReboot=1
    LAST_WIFI_CLIENT="$AVNAV_WIFI_CLIENT"
else
    log "AVNAV_WIFI_CLIENT unchanged"
fi
LAST_DATA+=("LAST_WIFI_CLIENT=\"$LAST_WIFI_CLIENT\"")

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
LAST_DATA+=("LAST_HOSTNAME='$LAST_HOSTNAME'")

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
LAST_DATA+=("LAST_KBLAYOUT='$LAST_KBLAYOUT'")
LAST_DATA+=("LAST_KBMODEL='$LAST_KBMODEL'")

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
LAST_DATA+=("LAST_TIMEZONE='$LAST_TIMEZONE'")

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
LAST_DATA+=("LAST_WIFI_COUNTRY='$LAST_WIFI_COUNTRY'")

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
fi
LAST_DATA+=("LAST_MCS='$LAST_MCS'")

declare -A HATS=([PICANM]=setup-picanm.sh [WAVESHAREA8]=setup-waveshare-a8.sh [WAVESHAREA12]=setup-waveshare-a12.sh [WAVESHAREB]=setup-waveshare-b.sh [WAVESHARE2CH]=setup-waveshare-2ch.sh)

for hat in "${!HATS[@]}"
do
    key="AVNAV_${hat}_HAT"
    last="LAST_${hat}_HAT"
    value="${!key}"
    script="$pdir/${HATS[$hat]}"
    if [ ! -x "$script" ] ; then
        log "script $script for $hat does not exist"
    else
        if [ "$value" = "yes" ] ; then
            log "HAT $hat is enabled, running check"
            $script
            res=$?
            if [ "$res" = 1 ] ; then
                log "reboot requested by $hat"
                needsReboot=1
                hasChanges=1
            fi    
        else
            if [ "${!last}" = yes ] ; then
                log "remove config for hat $hat"
                $script remove
                hasChanges=1
                #TODO: should we trigger a reboot?
            else
                log "no config for HAT $hat"
            fi
        fi
    fi
    LAST_DATA+=("$last='$value'")
done

gn(){
    echo "$1" | tr -cd '[a-zA-Z0-9]' | tr '[a-z]' '[A-Z]'
}
#allowed modes for plugin dir and startup-check.sh
read -r -d '' MODES <<EOF
root:root:755
root:root:744
root:root:700
EOF

hasAllowedMode(){
    local perm=`find "$1" -maxdepth 0  -printf "%u:%g:%m\n"`
    if echo "$MODES" | grep -q "$perm" ; then
      return 0
    else
      log "invalid mode $perm for $1"
      return 1
    fi    
}

#for now only consider system plugins
#builtin are not necessary, user makes no sense...
PLUGINDIR=`dirname $0`/../plugins
PISCRIPT=startup-check.sh
if [ -d "$PLUGINDIR" ] ; then
    for plugin in `ls -1 "$PLUGINDIR"`
    do
        sn="$PLUGINDIR/$plugin/$PISCRIPT"
        dn="$PLUGINDIR/$plugin"
        if [ -x "$sn" ] ; then
          if hasAllowedMode "$dn" && hasAllowedMode "$sn" ; then
            piname=`gn "$plugin"`
            vname="AVNAV_$piname"
            lastname="LAST_$piname"
            lastvalue="${!lastname}"
            echo "checking plugin $sn, $vname"
            if [ "${!vname}" = "yes" ] ; then
              log "running $sn"
              ldata="yes"
              $sn
              rt=$?
              log "$sn returned $rt"
              if [ $rt = 1 ] ; then
                log "reboot requested by $sn"
                needsReboot=1
              fi
            else
              log "$vname not to set to yes"
            fi
            LAST_DATA+=("$lastname=${!vname}")
            if [ "${!vname}" != "$lastvalue" ] ; then
                hasChanges=1
            fi
          else  
            log "cannot handle $sn, permissions not correct"  
          fi
        fi
    done
fi

log "startup check done"
if [ "$hasChanges" = 1 ]; then
    log "writing back $LAST"
    echo "#startup check last" > $LAST
    for i in ${LAST_DATA[@]}
    do
        echo "$i" >> $LAST
    done
    chmod 600 $LAST
fi
if [ $needsReboot = 1 ] ; then
    if [ "$1" = "noreboot" ] ; then
        echo "***reboot needed***"
        exit 2
    fi
    echo "****rebooting now****"
    log "****rebooting now****"
    reboot
fi
exit 0    



