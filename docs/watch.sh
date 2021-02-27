#! /bin/sh
while true; do inotifywait -e modify -e create -e delete -r `dirname $0`; `dirname $0`/../sync-hp.sh ; done
