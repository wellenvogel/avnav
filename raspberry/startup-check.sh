#! /bin/bash
#AvNav raspberry startup checks
#set -x
CONFIG=/boot/avnav.conf
LAST=/etc/avnav-startup-checks
MCS_INSTALL=`dirname $0`/setup-mcs.sh
pdir=`dirname $0`
pdir=`readlink -f $pdir`
AVNAV_SETUP_HELPER="$pdir/setup-helper.sh"
export AVNAV_SETUP_HELPER
. "$AVNAV_SETUP_HELPER"

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
force=0
if [ "$AVNAV_CONFIG_SEQUENCE" != "" ] ; then
    if [ "$LAST_CONFIG_SEQUENCE" != "" -a "$AVNAV_CONFIG_SEQUENCE" != "$LAST_CONFIG_SEQUENCE" ] || [ "$LAST_CONFIG_SEQUENCE" = "" -a "$AVNAV_CONFIG_SEQUENCE" != "1" ]; then
        log "config sequence changed from $LAST_CONFIG_SEQUENCE to $AVNAV_CONFIG_SEQUENCE, force re-apply"
        force=1
        hasChanges=1
    fi
    LAST_DATA+=("LAST_CONFIG_SEQUENCE='$AVNAV_CONFIG_SEQUENCE'")
fi
if [ "$AVNAV_PASSWD" != "" ] ; then
    if [ "$AVNAV_PASSWD" = "$LAST_PASSWD" -a $force = 0 ] ; then
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
    #no need to handle force here as the wifi handling will directly access the set data
    log "AVNAV_WIFI_CLIENT=$AVNAV_WIFI_CLIENT"
    hasChanges=1
    needsReboot=1
    LAST_WIFI_CLIENT="$AVNAV_WIFI_CLIENT"
else
    log "AVNAV_WIFI_CLIENT unchanged"
fi
LAST_DATA+=("LAST_WIFI_CLIENT=\"$LAST_WIFI_CLIENT\"")

if [ "$AVNAV_HOSTNAME" != "$LAST_HOSTNAME" -a "$AVNAV_HOSTNAME" != "" ] || [ $force = 1 -a "$AVNAV_HOSTNAME" != "" ]; then
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

if [ "$AVNAV_KBLAYOUT" != "$LAST_KBLAYOUT" -o "$AVNAV_KBMODEL" != "$LAST_KBMODEL" -o $force = 1 ] ; then
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

if [ "$AVNAV_TIMEZONE" != "$LAST_TIMEZONE" -a "$AVNAV_TIMEZONE" != "" ] || [ "$AVNAV_TIMEZONE" != "" -a $force = 1 ] ; then
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

if [ "$AVNAV_WIFI_COUNTRY" != "$LAST_WIFI_COUNTRY" -a "$AVNAV_WIFI_COUNTRY" != "" ] || [ "$AVNAV_WIFI_COUNTRY" != "" -a $force = 1 ]; then
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

#check if the enabled state has changed
# $1: lastval
# $2: val
# handles force
# returns 0 if changed
enableChanged(){
    [ $force = 1 ] && return 0
    if [ "$1" = yes ] ; then
        if [ "$2" != "$1" ] ; then
            return 0
        else
            return 1
        fi
    else
        if [ "$2" = yes ] ; then
            return 0
        else
            return 1
        fi
    fi
}

runMcs=0
if enableChanged "$LAST_MCS" "$AVNAV_MCS" ; then
    hasChanges=1
    mode=$MODE_EN
    if [ "$AVNAV_MCS" != yes ] ; then
        mode=$MODE_DIS
    fi
    if [ ! -f "$MCS_INSTALL" ] ; then
        log "ERROR: $MCS_INSTALL not found, cannot set up MCS"
    else
        log "running $MCS_INSTALL $mode"
        "$MCS_INSTALL" -p $mode    
        rt=$?
        log "mcs install returned $rt"
        if [ $rt = 1 ] ; then
            log "reboot requested by MCS install"
            needsReboot=1
            LAST_MCS="$AVNAV_MCS"
        fi
        if [ $rt -ge 0 ] ; then
            LAST_MCS="$AVNAV_MCS"
        fi
    fi    
else
    log "AVNAV_MCS unchanged $AVNAV_MCS"
fi
LAST_DATA+=("LAST_MCS='$LAST_MCS'")

declare -A HATS=([PICANM]=setup-picanm.sh [WAVESHAREA8]=setup-waveshare-a8.sh [WAVESHAREA12]=setup-waveshare-a12.sh [WAVESHAREB]=setup-waveshare-b.sh [WAVESHARE2CH]=setup-waveshare-2ch.sh [MCARTHUR]=setup-mcarthur.sh)


hatScript=''
getHatScript(){
    hatScript="${HATS[$1]}"
    if [ "$hatScript" = "" ] ; then 
       log "WARNING: unknown HAT $1, cannot $2"
       return 1 
    fi
    hatScript="$pdir/$hatScript"
    if [ ! -x "$hatScript" ] ; then
        log "ERROR: script $hatScript for hast $1 not found, cannot $2"
        return 1
    fi
    return 0
}

if [ "$AVNAV_HAT" != "$LAST_HAT" -o $force = 1 ] ; then
    if [ "$AVNAV_HAT" != "$LAST_HAT" ] ; then
      #try to disable old
      if [ "$LAST_HAT" != "" -a "$LAST_HAT" != NONE ] ; then
        if getHatScript "$LAST_HAT" $MODE_DIS ; then
            "$hatScript" $MODE_DIS    
        fi
      fi
    fi
    if [ "$AVNAV_HAT" != "" -a "$AVNAV_HAT" != NONE ] ; then
        if getHatScript "$AVNAV_HAT" $MODE_EN ; then
            "$hatScript" $MODE_EN
            res=$?
            if [ "$res" = 1 ] ; then
                log "reboot requested by $AVNAV_HAT"
                needsReboot=1 
            fi
            if [ $res -ge 0 ] ; then
                LAST_HAT="$AVNAV_HAT"
                hasChanges=1
            fi
        fi
    else
        LAST_HAT="$AVNAV_HAT"
        hasChanges=1    
    fi
else
    log "AVNAV_HAT unchanged $AVNAV_HAT"
fi
LAST_DATA+=("LAST_HAT='$LAST_HAT'")

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
PLUGINDIR="$pdir/../plugins"
PISCRIPT=plugin-startup.sh
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
            value="${!vname}"
            mode=''
            if [ "$value" = yes -o "$lastvalue" = yes ] ; then
                if [ "$value" != "$lastvalue" -o $force = 1 ] ; then
                    hasChanges=1
                    if [ "$value" = yes ] ; then
                        mode=$MODE_EN
                    else
                        mode=$MODE_DIS
                    fi
                fi
                log "running $sn $mode"
                "$sn" $mode
                rt=$?
                log "$sn returned $rt"
                if [ $rt = 1 ] ; then
                    if [ "$mode" = $MODE_EN ] ; then
                        log "reboot requested by $sn"
                        needsReboot=1
                    fi
                fi
                if [ $rt -ge 0 -o "$mode" = $MODE_DIS ] ; then
                    lastvalue="$value"    
                fi
            fi
            LAST_DATA+=("$lastname=$lastvalue")
          else  
            log "cannot handle $sn, permissions not correct"  
          fi
        fi
    done
fi

#drivers
driverscript="$pdir/driver/setup.sh"

if [ -x "$driverscript" ] ; then
    modules=($("$driverscript" list))
    for mod in ${modules[@]}
    do
        vname="AVNAV_MODULE_$mod"
        lastname="LAST_MODULE_$mod"
        lastvalue="${!lastname}"
        value="${!vname}"
        if [ "$lastvalue" != "$value" -o $force = 1 ] ; then
            log "$vname=$value"
            hasChanges=1
            mode=$MODE_DIS
            if [ "$value" = yes ] ; then
                mode=$MODE_EN
            fi
            "$driverscript" $mode $mod
            res=$?
            if [ $res = 1 -a $mode = $MODE_EN ]; then
                needsReboot=1
            fi
            if [ $res -ge 0 -o $mode = $MODE_DIS ] ; then
                lastvalue=$value
            fi
        else
            log "$vname unchanged $value"
        fi
        LAST_DATA+=("$lastname=${lastvalue}")
    done
else
    log "$driverscript not found, do not handle modules"
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



