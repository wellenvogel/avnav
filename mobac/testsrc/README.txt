(C) Andreas Vogel andreas@wellenvogel.de

This project extend the mobile atlas creator (http://mobac.sourceforge.net/) by a "pseudo" map source, that 
extend the features of xml defined map sources.
Basically it provides 3 new types:
exCustomMultiLayerMapSource
exCustomWmsMapSource
exCustomMapSource
and a "pseudo" map source that should not directly be used (simply displays an image).
The mapsource behave like their counterparts without "ex" - see 
http://sourceforge.net/apps/phpbb/mobac/viewtopic.php?f=2&t=2
http://sourceforge.net/apps/mediawiki/mobac/index.php?title=Custom_XML_Map_Sources
except that they expect a file with the extension ".exml".

They extend the basic functionality by the following parameters:
exCustomMapSource:
exCustomWmsMapSource:
<retries>someNumber</retries> 	- the number of retries when retrieving tiles
				  on errors they write transparent images when <ignoreErrors> is set.
<colorMappings>			- a mapping of colors to e.g. increase the readability
	<colorMapping>
		<in>#AB0102</in>
		<out>#FEFEFE</out>
	</colorMapping>
</colorMappings>
exCustomWmsMapSource:
<layerMappings>			- an option to override the default layers on different zoom levels
	<layerMapping>
		<zoom>1,2,3,4,5,6,7,8,9,10</zoom>
		<layers>someLayer</layers>
	</layerMappings>
</layerMappings>

Attached are 2 examples for accessing the German bsh mapservice (http://www.bsh.de/de/Meeresdaten/Geodaten/index.jsp).

Some used color mappings (you can try them e.g. with paint.net).
Colors BSH
10m:	171,210,255	ABD2FF	-> 	255,255,255	FFFFFF
5m?:	161,216,255	A1D8FF
>5m??	161,200,255	A1C8FF	->	221,235,255	DDEBFF
??:	156,195,255 	9CC3FF 	->	186,213,255	BAD5FF
3m:	150,191,255	96A1FF	-> 	121,159,216 	799FD8
2m:	135,179,255	87B3FF	->	88,131,206	5883CE
