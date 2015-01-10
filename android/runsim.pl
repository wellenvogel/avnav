#! /usr/bin/env perl
use strict;
use IO::Socket;
use IO::Select;
use Time::HiRes qw(time);
if (scalar(@ARGV) < 1) {
  print "usage: $0 file [waittime]\n";
  exit 1;
}
my $file=shift;
my $wt=shift;
$wt=0.5 if (! $wt);
open(my $h,"<",$file) or die "unable to open $file";
my $sock=new IO::Socket::INET (
                                  PeerAddr => 'localhost',
                                  PeerPort => '5554',
                                  Proto => 'tcp',
                                 );
die "unable to connect to localhost:5554" if (! $sock);
$sock->blocking(0);
my $read_set = new IO::Select(); # create handle set for reading
$read_set->add($sock);
while (<$h>){
	my $ltime=time();
	my $str="geo nmea $_";
	print $str;
	while ($str){
		if ($read_set->can_write($sock)){
			my $num=$sock->send($str);
			#print "$num written\n";
			$str=substr($str,$num);
		}
	}
	while (1){
		my $stime=time();
		my ($rh_set)=$read_set->select($read_set,undef,undef,($wt-($stime-$ltime)));
		#print "sret\n";
		$stime=time();
		for my $rh (@$rh_set){
			my $ret=$sock->read(my $buf,1000);
			print $buf if ($ret >= 0);
		}
		#print "l ".($stime-$ltime)."\n";
		last if ($stime > ($ltime+$wt));
	}
}
