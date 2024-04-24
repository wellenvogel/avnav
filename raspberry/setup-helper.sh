#(bash) helper functions for set up of /boot/config.txt and other cfg files
BOOTCONFIG=/boot/config.txt
_BOOTCFGNEW=/boot/firmware/config.txt
MODE_EN="enable"
MODE_DIS="disable"

log(){
    local n=`basename $0 .sh`
    echo "$n: $*"
    logger -t "$n" "$*"
}
err(){
    log "ERROR: $*"
}
errExit(){
    err "$*"
    exit 1
}
if [ -f $_BOOTCFGNEW ] ; then
    log "found $_BOOTCFGNEW - using this one"
    BOOTCONFIG=$_BOOTCFGNEW
fi

# check and update a config file
# $1: name of the config file
# $2: comment pattern
# $3: content
# $4: if set:do not copy to .save
# returns 1 if changed, < 0 on error
checkConfig(){
    local pattern="$2"
    local config="$1"
    local cfgdata="$3"
    local startPattern="#${pattern}_START"
    local endPattern="#${pattern}_END"
    local ret=0
    if grep "$pattern" "$config" > /dev/null ; then
        log "$config found $pattern, checking"
        local cur="`sed -n /$startPattern/,/$endPattern/p $config | grep -v $pattern`"
        if [ "$cur" = "$cfgdata" ] ; then
            log "$config ok"
        else
            log "updating $config, reboot needed"
            ret=1
        fi
    else
        log "must modify $config, reboot needed"
        ret=1
    fi
    if [ "$ret" = 1 ] ; then
        if [ -f "$config" ] ; then
            if [ "$4" = "" ] ; then
                cp $config $config.save || { err "unable to copy to $config.save"; return -1;}
            fi
        else
            touch $config || { err "unable to create $config"; return -1;}
        fi
        sed -i "/$startPattern/,/$endPattern/d" "$config" ||  { err "unable to cleanup $config"; return -1;}
        echo "$startPattern" >> "$config" ||  { err "unable to write to $config"; return -1;}
        echo "$cfgdata" >> "$config" ||  { err "unable to write to $config"; return -1;}
        echo "$endPattern" >> "$config" ||  { err "unable to write to $config"; return -1;}
    fi
    return $ret
}
# $1: name of the config file
# $2: comment pattern
# $3: if set:do not copy to .save
# returns 1 if changed, < 0 on error
removeConfig(){
    local pattern="$2"
    local config="$1"
    local startPattern="#${pattern}_START"
    local endPattern="#${pattern}_END"
    local ret=0
    if grep "$pattern" "$config" > /dev/null ; then
        log "$config found $pattern, removing"
        ret=1
    fi
    if [ "$ret" = 1 ] ; then
        if [ "$3" = "" ] ; then
            cp $config $config.save || { err "unable to copy to $config.save"; return -1;}
        fi
        sed -i "/$startPattern/,/$endPattern/d" "$config" ||  { err "unable to cleanup $config"; return -1;}
    fi
    return $ret
}

replaceConfig(){
    local config="$1"
    local cfgdata="$2"
    local cur="`grep "\$cfgdata\" \"$config\" 2>/dev/null`" 
    if [ "$cur" != "$cfgdata" ] ; then
        log "must change $config"
        local dn="`dirname \"$config\"`"
        if [ ! -d "$dn" ] ; then
            mkdir -p "$dn"
        fi
        echo "$cfgdata" > "$config" || { err "unable to replace config $config"; return -1;}
        return 1

    else
        log "$config ok"
    fi
    return 0
}
#check the result of the last command
#set the global needsReboot
checkRes(){
    local res=$?
    [ "$res" -lt 0 ] && exit $res
    if [ "$res" = 1 ] ; then
        needsReboot=1
    fi
}