#! /usr/bin/env perl
# workaround for broken 8192cu driver in stretch
# see https://raspberrypi.stackexchange.com/questions/88137/unable-to-switch-wifi-networks-using-usb-dongle-on-raspbian-stretch
# will be called whenever we connect to a WLAN if configured as restartWlan command
# this of course alos could drop your access point if you run this with an USB adapter
# so you need to decide whether to configure it or not
# hopefully there will be a correction in the future

use strict;

my $NAME="avnav-wlan-av1";
sub checkModule(){
  system("lsmod | grep 8192cu > /dev/null 2>&1");
  return $?;
}

sub syslog($){
	system("logger -t $NAME $_[0]");
}
sub restart(){
	syslog("restarting");
	system(" ( ifdown wlan-av1; rmmod 8192cu; modprobe 8192cu ) < /dev/null 2>&1 | logger -t $NAME");
	syslog("restart finished");
}
open(my $rd,"-|","journalctl -f");
die "unable to open syslog" unless $rd;
my $errCount=0;
while (<$rd>){
	chomp;
	next unless $_ =~ /wpa_supplicant.*wlan-av1: Association request to the driver failed/;
	$errCount++;
	if ($errCount > 3){
		if (checkModule() == 0) {
			print "restart...\n";
			restart();
		}
		$errCount=0;
	}

}
