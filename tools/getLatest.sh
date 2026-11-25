#! /bin/bash
#get latest release or daily tag
pdir=`dirname $0`
( $pdir/listTags.sh -t "daily" 1 ; $pdir/listTags.sh -t "release" ) |  while IFS="," read a b ; do ts=`date -d "$b" '+%s'`; echo "$ts $a"; done| sort -n -r | cut -d " " -f 2 | head -1

