#! /bin/bash
err(){
  echo "ERROR: $*"
  exit 1
}
[ "$HOME" = "" -o ! -d "$HOME" ] && err HOME not set or no directory
tag=latest
if [ "$1" != "" ] ; then
  tag="$1"
  echo "tag=$tag"
fi
WORKDIR=$HOME/.sktest-$tag
if [ ! -d "$WORKDIR" ] ; then
  mkdir -p "$WORKDIR"
  [ ! -d "$WORKDIR" ] && err unable to create "$WORKDIR"
fi
chmod a+w $WORKDIR
echo "workdir=$WORKDIR"
#docker run --rm -ti --name signalk-server -p 3000:3000 -u`id -u`:`id -g` -v "$WORKDIR":/home/node/.signalk signalk/signalk-server
docker run --rm -ti --name signalk-server -p 3000:3000  -v "$WORKDIR":/home/node/.signalk signalk/signalk-server:$tag
 
