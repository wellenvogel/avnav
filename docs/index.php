<?php
$script=__FILE__;
$me=$_SERVER['REQUEST_URI'];
$ifc="docs/beschreibung.html";
$mepath=preg_replace('?/[^/]*$?','',preg_replace("&[?].*&","",$me));
$mebase=preg_replace("&[?].*&","",$me);
if (isset($me)){
  $base="<dummy x=\"$me\"/dummy><base href=\"".$mepath."/".$ifcpath."\"></base>";
  }
$headercontent="<title>wellenvogel-Software</title>$base";
$headline="Wellenvogel - Avnav";
$navlist=array(
    array('url'=>"$mepath/index.php",'title'=>'Start'),
	array('url'=>"$mepath/index.php?ifc=docs/demo.html",'title'=>'Demo'),
	array('url'=>"$mepath/index.php?ifc=docs/install.html",'title'=>'Installation'),
	array('url'=>"$mepath/index.php?ifc=docs/release.html",'title'=>'Releases'),
	array('url'=>"$mepath/index.php?ifc=docs/avnav-chart-convert-de.html",'title'=>'Karten'),
	array('url'=>"$mepath/index.php?ifc=docs/avnav-de.html",'title'=>'Beschreibung'),
	array('url'=>"$mepath/index.php?ifc=docs/avnav-android-de.html",'title'=>'Android'),
	array('url'=>"$mepath/../../segeln/index.php",'title'=>'Segeln'),
);
include "../../Templates/top.php";

if (isset($_REQUEST['ifc'])) $ifc=$_REQUEST['ifc'];
$ifc=preg_replace("&[^0-9a-zA-Z./_-]*&","",$ifc);
$ifc=preg_replace("/\.\./","",$ifc);
$ifcpath=preg_replace("?[^/]*$?","",$ifc);
$ifc=dirname($script)."/".$ifc;

function callback($match){
  global $mebase,$ifcpath;
 #print_r($match);
  if ($match[2]!=""){
    return $match[1].$match[2].$match[3].$match[4];   
  }
  if ($match[3]=="/"|| $match[3]=="."){
    return $match[1].$match[3].$match[4];
  }
  return $match[1].$mebase."?ifc=".$ifcpath."/".$match[3].$match[4];  
}
function callbacksrc($match){
  global $mebase,$ifcpath;
  #print_r($match);
  if ($match[2]!=""){
    return $match[1].$match[2].$match[3].$match[4];   
  }
  if ($match[3]=="/"|| $match[3]=="."){
    return $match[1].$match[3].$match[4];
  }
  return $match[1].$ifcpath."/".$match[3].$match[4];  
}
$f=fopen($ifc,"r");
while ($line=fgets($f)){
  $line=preg_replace_callback('&(href= *")(https?[:]//)?(.)([^"]*)&',"callback",$line);
  $line=preg_replace_callback('&(src= *")(https?[:]//)?(.)([^"]*)&',"callbacksrc",$line);  
  print $line;
}

include "../../Templates/body-bottom.php";
?>

