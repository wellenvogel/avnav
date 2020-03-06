<?php
# vim: ts=2 sw=2 et
###############################################################################
# Copyright (c) 2012, Andreas Vogel andreas@wellenvogel.net
#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
################################################################################

# a description of testdata files
# they are build of fixed len records
# each record consist of a timestamp, a space and the json data (padded with spaces)

$tstdata=array(
	'gps'=>array('name'=>'json-gps.tst.fxl'),
	'ais'=>array('name'=>'json-ais.tst.fxl'),
	'track'=>array('name'=>'json-trk.tst.fxl'),
);
#for finding the entry in the file we use a fairly simple algorithm:
#read the first line, determine recordlength and starttime
#read the last line (eof-recordlength), determine endtime
#compute timeoffset as offset of current minute/second in the file
#compute fileoffset as timeoffset/(end-start) * filesize - round to n*recordlen
function readFileEntry($rqtype){
	global $tstdata;
	$fdata=$tstdata[$rqtype];
	if (! isset($fdata)) return '{"status":"no fdata"}';
	$fname=$fdata['name'];
	if (! file_exists($fname)){
		return "{\"status\":\"file $fname does not exist\"}";
	}
	$h=fopen($fname,"rb");
	if (! $h) return "";
	$first=preg_replace('/\n/','',fgets($h));
	$rlen=strlen($first)+1;
	//echo "rlen=$rlen, first=$first\n";
	fseek($h,-$rlen,SEEK_END);
	$last=preg_replace('/\n/','',fgets($h));
	//echo "last=$last\n";
	$farr=preg_split('/ +/',$first,3);
	$larr=preg_split('/ +/',$last,3);
	$tdiff=$larr[0]-$farr[0];
	//echo "first=".$farr[0].", delta=$tdiff\n";
	$flen=ftell($h);
	$cur=localtime();
	$ftime=localtime($farr[0]);
	$offsettime=mktime($ftime[2],$cur[1],$cur[0],$ftime[4]+1,$ftime[3],$ftime[5]+1900);
	//only add 1h if we are within a tolerance we have for all different files
	if ($offsettime < ($farr[0]-100)) $offsettime+=3600;
	if ($offsettime < $farr[0]) $offsettime=$farr[0];
	if ($offsettime > $larr[0]) $offsettime=$larr[0];
	//echo "offset ".date("r",$offsettime)."\n";
	$offset=($offsettime-$farr[0])/$tdiff;
	$obytes=$offset*$flen;
	$obytes=floor($obytes/$rlen)*$rlen;
	//echo "otime=$offsettime, offset=$offset,bytes=$obytes\n";
	fseek($h,$obytes,SEEK_SET);
	$entry=preg_replace('/\s*\n$/','',fgets($h));
	//echo "data=$entry\n";
	$edata=preg_split('/\s+/',$entry,2);
	return $edata[1];
}
$rq='gps';
if (isset($_REQUEST['request'])){
	$rq=$_REQUEST['request'];
}
$isEncoded=1;
if ($rq == 'listCharts'){
		$rt['status']='OK';
		$base=$_SERVER['REQUEST_URI'];
		$base=preg_replace("/\?.*/","",$base);
		$base=preg_replace("?/[^/]*$?","",$base);
		$de=array('name'=>'eniro','url'=>$base.'/demo-eniro','charturl'=>$base.'/demo-eniro');
		$de2=array('name'=>'bsh','url'=>$base.'/demo-bsh','charturl'=>$base.'/demo-bsh');
		$de3=array('name'=>'osm','url'=>$base.'/demo-osm','charturl'=>$base.'/demo-osm');
		$rt['data']=array($de,$de2,$de3);
		$isEncoded=0;
}
else if ($rq == 'listdir' || $rq == 'routing'){
    $rt['status']='OK';
    $rt['data']=array();
    $rt['items']=array();
    $isEncoded=0;
}
else if ($rq == 'nmeaStatus'){
	$rt='{"status": "OK", "data": {"nmea": {"status": "green", "source": "testreader", "info": "Sat 0 visible/0 used"}, "ais": {"status": "green", "source": "testreader", "info": "70 targets"}}}';
}
else {
	$rt=readFileEntry($rq);
}
header('Content-type: application/json');
if (! $isEncoded) echo json_encode($rt);
else echo $rt;

?>
