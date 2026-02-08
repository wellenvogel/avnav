#!/bin/bash

set -e

IF="$1"
BITRATE=250000

case "$2" in
  start)
    /sbin/ip link set "$IF" down || true
    if [[ "$IF" == vcan* ]]
    then
      modprobe vcan
      /sbin/ip link add dev "$IF" type vcan 2>/dev/null || true
      /sbin/ip link set "$IF" up
    else
      /sbin/ip link set "$IF" type can bitrate "$BITRATE" restart-ms 100 txqueuelen 10000
      /sbin/ip link set "$IF" up
    fi
    ;;
  stop)
    if [[ "$IF" == vcan* ]]
    then
      /sbin/ip link set "$IF" down || true
      /sbin/ip link del "$IF" 2>/dev/null || true
      rmmod vcan
    else
      /sbin/ip link set "$IF" down || true
    fi
    ;; 
   *)
         echo "Usage: $0 IFACE {start|stop}"
    exit 1
    ;;
esac

exit 0
