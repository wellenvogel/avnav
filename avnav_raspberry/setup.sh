#! /bin/sh

err(){
  echo "ERROR: $*"
  exit 1
}
i=`id -u`
[ "$i" != "0" ] && err "this must be run as root"
pdir=`dirname $0`
pdir=`readlink -f $pdir`
for serv in check_parts avnav
do
  if [ ! -h /etc/init.d/$serv ] ; then
    rm -f /etc/init.d/$serv
    echo "creating /etc/init.d/$serv"
    ln -s $pdir/$serv /etc/init.d/$serv
    chmod 755 $pdir/$serv
  else
    echo "/etc/init.d/$serv is already linked"
  fi
	
done

for d in ../tracks ../log ../charts
do
  d=$pdir/$d
  if [ -d $d -o -f $d ] ; then
    echo "moving old $d to $d.old"
    mv $d $d.old || err "unable to remove $d"
  fi
done

echo "starting partitioning check"
/etc/init.d/check_parts worker



