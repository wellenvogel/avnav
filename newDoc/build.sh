#! /bin/bash
IMAGE="wellenvogel/avnav-doc-build:1.4"
usage(){
    echo "usage: $0 [-b] [-d] [-h] [-p port] [<command>]"
}
useDocker=0
port=8000
address="127.0.0.1"
pdir=`dirname $0`
pdir=`readlink -f $pdir`
buttonUsage=0
while getopts "dhp:a:b" arg; do
  case "$arg" in
    b)
      buttonUsage=1
      ;;
    d)
      useDocker=1
      ;;      
    h)
      usage
      ;;
    p)
      port=$OPTARG
      ;;
    a)
      address=$OPTARG
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
if [ $useDocker = 1 ] ; then
  docker run -ti --rm -u`id -u` -v "`readlink -f $pdir/..`:/app" -p8000:$port "$IMAGE" /app/newDoc/build.sh -a 0.0.0.0 $command
  exit $?
fi

if [ $buttonUsage = 1 ] ; then
    #build the button usage files
    script="$pdir/../tools/buttonUsage.py"
    [ ! -x "$script" ]  && err "$script not found/not executable"
    gendir="$pdir/docs/buttons"
    if [ ! -d "$gendir" ] ; then
      echo "creating $gendir"
      mkdir -p "$gendir" || err "unable to create $gendir"
    fi
    outfile="$gendir/buttons.md"
    icondir="$pdir/docs/images/icons-new"
    $script -f buttonoverview -i "$icondir" -o "$outfile" || err "unable to create $outfile"
    outfile="$gendir/buttons.json"
    $script -f buttonjson -i "$icondir" -o "$outfile" || err "unable to create $outfile"
fi

if [ "$command" = none ] ; then
  exit 0
fi
cd $pdir || err ""
if [ "$command" = "serve" ] ; then
  mkdocs $command --dev-addr $address:$port
else
  mkdocs $command
fi




