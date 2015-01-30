#! /bin/sh
BASE=`dirname $0`
TARGET=/diskstation/web/homepage/software/avnav
set -x
rsync -rav --exclude="*bak" --exclude="*odg" --delete $BASE/docs/ $TARGET/docs
rsync -rav --include="*png" --include="*PNG" --exclude="*" --delete $BASE/viewer/images/ $TARGET/viewer/images/
rsync -rav --include="avnav_min.js" --include="loader.js" --include="avnav_viewer.html" --include="avnav_viewer.less" --exclude="*" --delete $BASE/viewer/ $TARGET/viewer

for lib in jquery jscolor less movable-type ol311 rangeslider
do
	rsync -rav --delete $BASE/libraries/$lib/* $TARGET/libraries/$lib/
done

chmod -R a+r $BASE

