#! /usr/bin/env perl
use strict;
#use warnings 'all';
use JSON::PP;
use File::Basename;
my $KBLIST="/usr/share/console-setup/KeyboardNames.pl";
my $pdir=dirname(__FILE__);
my $outfile="$pdir/keyboards.json";

die "$KBLIST not found" if (! -f $KBLIST);
do $KBLIST;

open(my $oh,">",$outfile) or die "unable to write $outfile";


my %frame=();
$frame{'models'}=\%KeyboardNames::models;
$frame{'layouts'}=\%KeyboardNames::layouts;
$frame{'variants'}=\%KeyboardNames::variants;



print $oh encode_json(\%frame);
