#! /bin/bash

usage(){
  echo "usage: $0 version"
}

if [ "$1" = "" ] ; then
  usage
  exit 1
fi

docker build -t "wellenvogel/avnav-doc-build:$1" docker
