<?php
$script=__FILE__;
$pdir=dirname($_SERVER['PHP_SELF']);
$headercontent="<title>wellenvogel-Software</title>$base";
$headline="Wellenvogel - Avnav";
$navlist=array(
    array('url'=>"$pdir/docs/beschreibung.html",'title'=>'Start'),
	array('url'=>"$pdir/docs/demo.html",'title'=>'Demo'),
	array('url'=>"$pdir/docs/install.html",'title'=>'Installation'),
	array('url'=>"$pdir/docs/release.html",'title'=>'Releases'),
	array('url'=>"$pdir/docs/avnav-chart-convert-de.html",'title'=>'Karten'),
	array('url'=>"$pdir/docs/userdoc.html",'title'=>'Beschreibung'),
	array('url'=>"$pdir/docs/hints/index.html",'title'=>'Spezielle Themen'),
	array('url'=>"$pdir/docs/avnav-android-de.html",'title'=>'Android'),
	array('url'=>"$pdir/../../segeln/index.php",'title'=>'Segeln'),
);
include "../../Templates/top.php";

function getScriptRoot(){
  $root=realpath(dirname(__FILE__));
  $doc=realpath($_SERVER['DOCUMENT_ROOT']);
  return substr($root,strlen($doc))."/";
}

function sanitize($ifc,$base){
    $ifc=preg_replace("&[^0-9a-zA-Z./_-]*&","",$ifc);
    $ifc=preg_replace("/\.\./","",$ifc);
    $ifcpath=preg_replace("?[^/]*$?","",$ifc);
    $ifc=$base."/".$ifc;
    return $ifc;
}

if (isset($_REQUEST['dir'])){
    $dir=sanitize($_REQUEST['dir'],"");
    if (is_dir(dirname(__FILE__).$dir)){
        print "<iframe class=\"full\" src=\"".getScriptRoot().$dir."\"/>";
    }
}
else{

    if (isset($_REQUEST['ifc'])){
        $ifc=$_REQUEST['ifc'];
    }
    else{
        $ifc="docs/beschreibung.html";
    }
    $ifc=sanitize($ifc,dirname($script));

    $f=fopen($ifc,"r");
    while ($line=fgets($f)){
        print $line;
    }
}

include "../../Templates/body-bottom.php";
?>

