#! /bin/bash
IMAGE="wellenvogel/avnav-doc-build:1.2"
usage(){
    echo "usage: $0 [-d] [-h] [-p port] [<command>]"
}
useDocker=0
port=8000
while getopts "dhp" arg; do
  case "$arg" in
    d)
      useDocker=1
      ;;      
    h)
      usage
      ;;
    p)
      port=$OPTARG
      ;;
  esac
done
shift $((OPTIND-1))

command='build'
if [ "$1" != "" ] ; then
  command=$1
fi

err(){
    echo "ERROR: $*"
    exit 1
}

#build the button usage files
pdir=`dirname $0`
pdir=`readlink -f $pdir`
script="$pdir/../tools/buttonUsage.py"
[ ! -x "$script" ]  && err "$script not found/not executable"
gendir="$pdir/docs/generated"
if [ ! -d "$gendir" ] ; then
  echo "creating $gendir"
  mkdir -p "$gendir" || err "unable to create $gendir"
fi
outfile="$pdir/docs/generated/buttons.md"
icondir="$pdir/docs/images/icons-new"
$script -f buttonoverview -i "$icondir" -o "$outfile" || err "unable to create $outfile"
outfile="$pdir/docs/generated/buttons.json"
$script -f buttonjson -i "$icondir" -o "$outfile" || err "unable to create $outfile"

cd $pdir || err ""
if [ $useDocker = 1 ] ; then
  if [ "$command" = "serve" ] ; then
    command="$command --dev-addr 0.0.0.0:8000 "
  fi
  docker run -ti --rm -u`id -u` -v "`readlink -f $pdir/..`:/app" -p8000:$port "$IMAGE" mkdocs `echo $command`
else
  if [ "$command" = "serve" ] ; then
    command="$command --dev-addr 127.0.0.1:$port"
  fi
  mkdocs `echo $command`
fi




