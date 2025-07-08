#! /bin/sh
BASE=`dirname $0`
TARGET=/diskstation/web/homepage/software/avnav
SUB=release
if [ "$1" != "" ] ; then
 SUB=$1
fi
set -x
rsync -rav --no-links --include=.htaccess --exclude-from="$BASE/exclude.sync" --delete $BASE/docs/ $TARGET/docs
rsync -rav --no-links --include=.htaccess --exclude-from="$BASE/exclude.sync" $BASE/docs/downloads/ $TARGET/downloads
rsync -rav --include="*php" --exclude="*" $BASE/docs/ $TARGET
rsync -rav --delete $BASE/viewer/build/$SUB/ $TARGET/viewern
rsync -rav --delete $BASE/viewer/demo/ $TARGET/viewer
rsync -rav --delete $BASE/mobac/testsrc/build/libs/avnav-mapsources.zip $TARGET/downloads
rsync -L -rav --delete --exclude=".idea" $BASE/raspberry/configui/ $TARGET/configGen

chmod -R a+r $BASE

