#! /bin/sh
BASE=`dirname $0`
TARGET=/diskstation/web/homepage/software/avnav
SUB=release
if [ "$1" != "" ] ; then
 SUB=$1
fi
set -x
rsync -rav --no-links --include=.htaccess --exclude="*bak" --exclude="*odg" --exclude="*php" --delete $BASE/docs/ $TARGET/docs
rsync -rav --no-links --include=.htaccess --exclude="*bak" --exclude="*odg" --exclude="*php" $BASE/docs/downloads/ $TARGET/downloads
rsync -rav --include="*php" --exclude="*" $BASE/docs/ $TARGET
rsync -rav --delete $BASE/viewer/build/$SUB/ $TARGET/viewern
rsync -rav --delete $BASE/viewer/demo/ $TARGET/viewer
rsync -rav --delete $BASE/mobac/testsrc/build/libs/avnav-mapsources.zip $TARGET/downloads
rsync -L -rav --delete --exclude=".idea" $BASE/raspberry/configui/ $TARGET/configGen
cp -p $BASE/docs/indexav.json $TARGET/index.json

for lib in movable-type 
do
	rsync -rav --delete $BASE/libraries/$lib/* $TARGET/libraries/$lib/
done

chmod -R a+r $BASE

