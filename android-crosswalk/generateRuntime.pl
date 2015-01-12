#! /usr/bin/env perl
# vim: ts=2:et:sw=2:
# script to create a small application that bundles the crosswalk runtime
# requires an unpacked crosswalk dir downloaded from
# https://crosswalk-project.org/documentation/downloads.html
use strict;
use File::Basename;
use File::Copy 'copy';
use Cwd 'abs_path';
use Getopt::Long;
use XML::LibXML;
use Data::Dumper;
my $PACKAGE="de.wellenvogel.xwalk";
my $NAME="AvNavXwalk";
my $BUILDNAME="Xwalk"; #the cw tooling has some strange idea how to create this from the App name
my $MANIFEST="app/manifest.tpl";
my $APPBASE="app"; #below basedir
my $COMMAND="make_apk.py";
my $CONFIG="../android/local.properties"; #relative to basedir
my $VERSIONLOG="versions.log";
#control the output file name
my $CUSTOMERULE="custom_rules.xml"; 
#options
my $keystorepass;
my $keyaliaspass;
my $keystore;
my $keyalias="wellenvogel";

sub usage(){
  print "usage: $0 pathToCrosswalk version [versionString]\n";
  print "       versionString must match the version in the app and should be equal to the crosswalk version\n";
  print "       will be retrieved from the crosswalk tooling if not provided\n";
  print "       version must count up from the last delivery\n";
  print "       --keystore-passcode for the android build keytore password\n";
  print "       --keystore-alias-passcode for the key allias password\n";
  print "       --keystore-path keystore for signing (otherwise try to get from $CONFIG)\n";
  print "       --keystore-alias keystore alias for signing (if keytore path is given, defaults to $keyalias)\n";
}

sub err($;$){
  my ($txt,$usage)=@_;
  print STDERR "ERROR: $txt\n";
  usage() if ($usage);
  exit(1);
}
sub wLog($){
  print "LOG: ".$_[0]."\n";
}

sub replaceTemplates($$$){
  my ($in,$out,$vals)=@_;
  open(my $h,"<",$in) or err("unable to read $in");
  open(my $o,">",$out) or err("unable to write $out");
  while (<$h>){
    foreach my $k (keys(%$vals)){
      my $v=$vals->{$k};
      s/#$k#/$v/g;
    }
    print $o $_;
  }
  close($h);
  close($o);
}


my %options=("keystore-passcode=s" =>\$keystorepass,
  "keystore-alias-passcode=s" =>\$keyaliaspass,
  "keystore-path=s" => \$keystore,
  "keystore-alias=s" => \$keyalias);

GetOptions(%options) or err("invalid option",1);

if (scalar(@ARGV) < 2) {
  err("missing parameters",1);
}
my $xwalk=$ARGV[0];
my $version=$ARGV[1];
my $versionString="";
if (scalar(@ARGV)> 2){
  $versionString=$ARGV[2];
}

if (! -d $xwalk){
  err("crosswalk directory $xwalk not found");
}
my $xwalk=abs_path($xwalk);
my $cmd=$xwalk."/".$COMMAND;
if (! -f $cmd){
  err("command $cmd not found");
}
my $base=dirname($0);
my $base=abs_path($base);
my $appbase=$base."/".$APPBASE;
chdir $base or err("unable to cd to $base");
if ( $versionString eq "") {
  my $vcmd="cd $xwalk && python $cmd -v";
  wLog("query version from crosswalk with $vcmd");
  my $vinfo=`$vcmd`;
  chomp($vinfo);
  my $pattern="tool version is";
  if ($vinfo eq "" || $vinfo !~ /$pattern/){
    err("no version got from crosswalk: $vinfo");
  }
  $vinfo=~s/.*$pattern *//;
  wLog("got version $vinfo from crosswalk");
  $versionString=$vinfo;
}
if (! -f $MANIFEST) {
  err("manifest template $MANIFEST not found");
}

my $mf="$appbase/manifest.json";
open(my $h,"<",$MANIFEST) or err("unable to read $MANIFEST");
open(my $o,">",$mf) or err("unable to write $mf");
wLog("writing $mf, name=$NAME, version=$versionString");
my %repl=('NAME'=>$NAME,'VERSION'=>$versionString);
replaceTemplates($MANIFEST,$mf,\%repl);
my $cmbase="python $cmd --name=$NAME --package=$PACKAGE --permissions= --mode=embedded --app-root=$appbase --app-local-path=index.html --app-versionCodeBase=$version --project-only";
for my $arch ('arm','x86'){
  if (-d $arch){
    wLog("removing existing directory $arch");
    system("rm -rf $arch");
  }
  my $cmstring=$cmbase." --arch $arch --project-dir=$base/$arch";
  wLog("generating project for $arch, running: $cmstring");
  system($cmstring);
  err("$cmstring failed") if ($?);
  my $archbase=$arch."/".$BUILDNAME;
  for my $dir (glob($archbase."/native_libs/*")) {
    if ($dir !~ /native_libs.$arch/){
      wLog("removing invalid subdir $dir for arch $arch");
      system("rm -rf $dir");
    }
  }
  #remove unnecessary permissions
  my $androidManifest=$archbase."/AndroidManifest.xml";
  open (my $fh,"<",$androidManifest) or err("cannot read $androidManifest");
  binmode($fh);
  my $xml=XML::LibXML->load_xml(IO=>$fh);
  close($fh);
  err("invalid manifest $androidManifest") if (! $xml);
  my @oldParam=$xml->getElementsByTagName('uses-permission');
  for my $perm (@oldParam){
    my $curp=$perm->getAttribute('android:name');
    my $kept=0;
    foreach my $allow ('android.permission.ACCESS_NETWORK_STATE','android.permission.ACCESS_WIFI_STATE'){
      if ($curp eq $allow){
        $kept=1;
      }
    }
    if (! $kept){
      wLog("omitting permission $curp");
      $perm->unbindNode();
    }
  }
  unlink($androidManifest) or err("Unable to remove $androidManifest");
  open(my $h,">",$androidManifest) or err("Unable to rewrite $androidManifest");
  binmode($h);
  $xml->toFH($h);
  close($h);
  if (-f $CONFIG || $keystore) {
    my $prop=$archbase."/local.properties";
    if (! $keystore){
      open(my $h,"<",$CONFIG) or err("unable to read $CONFIG");
      open(my $o,">>",$prop) or err("unable to append to $prop");
      wLog("using configuration from $CONFIG, appending key entries to $prop");
      while (<$h>){
        next if $_ !~ /^ *key/;
        print $o $_;
    }
    close($o);
    close($h);
    }
    if (-f $CUSTOMERULE) {
      my $of=$archbase."/".$CUSTOMERULE;
      wLog("using $CUSTOMERULE");
      my %repl=('ARCH'=>$arch);
      replaceTemplates($CUSTOMERULE,$of,\%repl);
    }
    my $antoptions="";
    if ($keystorepass) {
      $antoptions.=" -Dkey.store.password=$keystorepass";
    }
    if ($keyaliaspass) {
      $antoptions.=" -Dkey.alias.password=$keyaliaspass";
    }
    if ($keystore) {
      $antoptions.=" -D.key.store=$keystore -Dkey.alias=$keyalias ";
    }
    my $buildcmd="cd $archbase && ant $antoptions release";
    wLog("building apk for $arch with command $buildcmd");
    system($buildcmd);
    err("building for $arch failed") if ($?);
    wLog("release artifact build for $arch version $version, versionCode=$versionString");
    my $log="$arch $version $versionString ".localtime();
    open($h,">>",$VERSIONLOG) or err("unable to log build to $VERSIONLOG");
    print $h $log."\n";
    close($h);
  }
  else {
    wLog("WARNING: no $CONFIG found, unable to generate apk");
  }
}


