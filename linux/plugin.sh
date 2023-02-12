#! /bin/sh

usage(){
    echo "usage: $0 hide plugin"
    echo "       $0 unhide plugin"
    echo "       $0 list"
    echo "       $0 set plugin param value"
    echo "       $0 unset plugin [param]"
    echo "       $0 lparam"
}
CFG=/etc/default/avnav
err(){
    echo "ERROR: $*"
    exit 1
}
ecfg(){
    err "unable to write $CFG"
}

gn(){
    echo "$1"  | tr -cd '[a-zA-Z0-9]' | tr '[a-z]' '[A-Z]'   
}
gnp(){
    echo "$1"  | tr -cd '[a-zA-Z0-9]_'    
}

if [ "$1" = "" ] ; then
  usage
  exit 1
fi

PREFIX=AVNAV_HIDE_
PARAM_PREFIX=AVNAV_PLUGIN_

if [ "$1" = "list" ]  ; then
  [ ! -f "$CFG" ] && exit 0
  sed -n 's/^ *AVNAV_HIDE_//p' "$CFG"
  exit 0
fi
if [ "$1" = "hide" ]  ; then
  [ "$2" = "" ] && err "missing parameter plugin"
  name=`gn "$2"`
  if [ -f "$CFG" ] ; then
    sed -i "/$PREFIX$name/d" "$CFG" || ecfg
  fi  
  echo "$PREFIX$name=1" >> "$CFG" || ecfg
  echo "export $PREFIX$name" >> "$CFG" || ecfg
  exit 0
fi
if [ "$1" = "unhide" ] ; then
  [ "$2" = "" ] && err "missing parameter plugin"
  name=`gn "$2"`
  if [ -f "$CFG" ] ; then
    if grep -q "^ *$PREFIX$name" "$CFG" ; then
      sed -i "/$PREFIX$name/d" "$CFG" || ecfg
    fi
  fi
  exit 0
fi
if [ "$1" = "set" ] ; then
  if [ $# -lt 4 ] ; then
    echo "missing parameter for set"
    usage
    exit 1
  fi
  name=`gn "$2"`
  param=`gnp "$3"`
  name="$PARAM_PREFIX${name}_$param"
  alreadyOk=0
  if [ -f "$CFG" ] ; then
    if grep -q -F "$name=$4" "$CFG" && grep -q -F "export $name" "$CFG" ; then
      exit 0
    fi  
    sed -i "/$name/d" "$CFG" || ecfg
  fi
  echo "$name=$4" >> "$CFG" || ecfg
  echo "export $name" >> "$CFG" || ecfg
  exit 0
fi
if [ "$1" = "unset" ] ; then
  if [ "$2"  = "" ] ; then
    echo "missing parameter for unset"
    usage
    exit 1
  fi
  name=`gn "$2"`
  if [ "$3" != "" ] ; then
    param=_`gnp "$3"`
  else
    param=_  
  fi
  name="$PARAM_PREFIX${name}$param"
  if [ -f "$CFG" ] ; then
    if grep -q "$name" "$CFG";then
      sed -i "/$name/d" "$CFG" || ecfg
    fi
  fi
  exit 0
fi
if [ "$1" = "lparam" ] ; then
  if [ -f "$CFG" ] ; then
    sed -n "s/^ *$PARAM_PREFIX//p" "$CFG"
  fi  
  exit 0
fi
usage
exit 1