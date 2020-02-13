#! /bin/sh
BASE=`dirname $0`
TARGET=/diskstation/web/homepage/software/avnav
SUB=release
if [ "$1" != "" ] ; then
 SUB=$1
fi
set -x
rsync -rav --no-links --include=.htaccess --exclude="*bak" --exclude="*odg" --exclude="*php" --delete $BASE/docs/ $TARGET/docs
rsync -rav --include="*php" --exclude="*" $BASE/docs/ $TARGET
rsync -rav --delete $BASE/viewer/build/$SUB/ $TARGET/viewern
rsync -rav --delete $BASE/mobac/testsrc/build/libs/avnav-mapsources.zip $TARGET/downloads
cp -p $BASE/docs/indexav.json $TARGET/index.json

for lib in movable-type ol3201
do
	rsync -rav --delete $BASE/libraries/$lib/* $TARGET/libraries/$lib/
done

chmod -R a+r $BASE

