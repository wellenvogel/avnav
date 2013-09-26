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

#simple gpx parsing for demo mode

$trkpnt=null;
$currentTs=null;
$idx=0;
$ptcounter=-1;
function startElement($parser, $name, $attrs){
	global $trkpnt,$currentTs,$ptcounter,$idx;
	if (strtolower($name) == "trkpt"){
		$ptcounter++;
		if ($ptcounter == $idx) {
			$trkpnt=$attrs;
		}		
	}
	if (strtolower($name) == "time" && $ptcounter == $idx){
		$currentTs=" ";
	}
}

function endElement($parser,$name){
	global $currentTs,$trkpnt;
	if ($currentTs != null && $currentTs != " "){
		if ($trkpnt != null){
			$trkpnt['time']=preg_replace("/^ */",'',$currentTs);
		}
		$currentTs=null;
	}
}

function characterHandler($parser,$data){
	//echo "character handler $data\n";
	global $currentTs;
	if ($currentTs != null){
		$currentTs=$data;
	}
}

$rt=array('class'=>'error');
if (isset($_REQUEST['demo'])){
	$fname=$_REQUEST['demo'];
	$fname=preg_replace('?/*?','',$fname); #minimal security...
	$fname=dirname(__FILE__).DIRECTORY_SEPARATOR."..".DIRECTORY_SEPARATOR."demo".DIRECTORY_SEPARATOR.$fname;
	$idxname=$fname.".idx";
	if (file_exists($fname)){
		$f=fopen($fname,"r");
		if (! $f) die("unable to open demo file $fname");
		$idx=-1;
		if (file_exists($idxname)){
			$if=fopen($idxname,"r");
			$idx=preg_replace('/\n/','',fgets($if));
			fclose($if);
		}
		$idx++;
		$xml_parser=xml_parser_create();
		xml_set_element_handler($xml_parser, "startElement", "endElement");
		xml_set_character_data_handler($xml_parser,"characterHandler");
		while ($data = fread($f, 4096)) {
			if (!xml_parse($xml_parser, $data, feof($f))) {
				die("parser error");
			}
		}
		fclose($f);
		if ($trkpnt == null){
			$idx=-1;
		}
		$if=fopen($idxname,"w");
		if ($if){
			fputs($if,"".$idx."\n");
			fclose($if);
		}
		if ($trkpnt != null) {
			$rt['class']="TPV";
			$rt['tag']="GGA";
			$rt['mode']=2;
			$rt['lat']=$trkpnt['LAT'];
			$rt['lon']=$trkpnt['LON'];
			$rt['time']=$trkpnt['time'];
		}
	}
}
$rq='gps';
if (isset($_REQUEST['request'])){
	$rq=$_REQUEST['request'];
}
if ($rq == 'listCharts'){
		$rt['status']='OK';
		$de=array('name'=>'demo','url'=>'.','charturl'=>'.');
		$rt['data']=array($de);
	}


header('Content-type: application/json');
echo json_encode($rt);

?>