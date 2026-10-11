AvnNav Karten und Overlays



Avnav Karten und Overlays {: #Chartconvert}
===========================================

Technischer Hintergrund {: #Intro}
----------------------------------

Damit Karten in der WebApp verwendet werden können, müssen sie in einem
„Kachelformat“ vorliegen. Das ist das Format, das durch Dienste wie
OpenStreetMaps oder GoogleMaps benutzt wird. Eine Kartenkachel ist 256x256
Pixel gross. Die Welt wird dabei auf eine ebene Fläche projiziert (das
kann man sich wie einen Papierzylinder vorstellen, der senkrecht steht und
am Äquator um die Erde gewickelt wird). Jeder Punkt mit seinen Koordinaten
(Länge/Breite) wird dann auf diesen Zylinder projiziert. Wie man das
macht, welche Einheiten in der Projektion verwendet werden und ob die
Erde als Kugel oder Ellipsoid mit verschiedenen Parametern modelliert
wird, beschreiben die verschiedenen Projektionen. Die WebApp benutzt die
sogenannte Google-Mercator-Projektion (die Erde wird dabei als Kugel
betrachtet) - mit dem EPSG Code 900913. Die Einheiten auf dem Papier sind
dabei Meter (die man natürlich in die entsprechenden Koordinaten umrechnen
kann). Karten in einem anderen Format (z.B. WGS84 – Erde als Ellipsoid,
immer in Grad) müssen daher ggf. reprojiziert werden.

Die gesamte Projektionsfläche wird bei der Google-Projektion in Kacheln
unterteilt. Der Zoom Level gibt an, in wieviele Kacheln die Fläche
unterteilt wird. Zoom Level 0 bedeutet: die gesamte Erde (von -85° bis
+85° Breite – darüber ist die Projektion nicht definiert) auf einer Kachel
von 256x256 Pixel. Mit jedem weiteren Zoom Level wird feiner unterteilt:
Zoom Level 1: 2x2 Kacheln, 2: 4x4 Kacheln usw. Für uns reichen die
interessanten Zoom Level von ca. 7 bis 18..19. Das bedeutet (Level 19)
2^19x2^19 Kacheln.

Zur Darstellung wird die Library [openlayers](http://www.openlayers.org/)
verwendet. Diese lädt die entsprechenden Kartenkacheln je nach Zoom Level
vom Raspberry und zeigt sie an. OpenStreetMaps verwendet typischerweise
diese Library.

Man kann sich leicht vorstellen, dass bei hohen Zoom Levels schnell große
Datenmengen zusammenkommen. Daher müssen wir für unsere Kartenkacheln
ähnlich vorgehen, wie es auch bei den Papierkarten ist: für Übersichten
ein kleinerer Zoom Level, Detailkarten größer und z.B. Hafenpläne dann mit
Level 18 oder 19 (60cm/pixel bzw. 30cm/pixel). Um damit arbeiten zu
können, werden die verschiedenen Detailgrade dann in Layern (Schichten)
übereinandergelegt. Wenn es für ein Gebiet einen Layer mit besserem
(größerem) Zoom Level gibt, wird dieser angezeigt - wenn nicht, der mit
der geringeren Auflösung (ggf. noch vergrössert). Um unsere Anzeigegeräte
nicht zu überlasten, kann man typisch mit 3-5 Kartenlayern arbeiten (je
nach Gerät...).

  

Kartenformate {: #chartformats}
-------------------------------

AvNav kann direkt Karten verarbeiten, die im Format [gemf](http://www.cgtk.co.uk/gemf)
oder [mbtiles](https://wiki.openstreetmap.org/wiki/MBTiles)
vorliegen. Diese Formate sind sogenannte Raster Formate, sie enthalten die
fertigen Kartenkacheln. Außerdem können auch Online-Kartendienste
verwendet werden, die ein solches Format bereitstellen.

Außerdem kann AvNav mit seinem [Importer](userdoc/importerpage.md)
eine ganze Reihe von weiteren Kartenformaten umwandeln, um sie nutzbar zu
machen. Das sind insbesondere Karten im \*.KAP Format.

AvNav kann auch Vektorkarten von [o-charts](https://o-charts.org/)
(mit dem  [ocharts](hints/ocharts.md) oder [ochartsng](hints/ochartsng.md)
plugin) und S57-Karten (nach Konvertierung über den Importer und das [ochartsng](hints/ochartsng.md)
plugin) nutzen. Diese Vektorkarten werden bei der Nutzung durch die
Plugins automatisch in Kartenkacheln umgewandelt.

Hinweis zu mbtiles: Bei diesem Format muss ggf. noch die richtige interne
Anordnung der Kacheln gewählt werden - der Standard is "xyz", es gibt aber
auch Dateien, die im "tms" Format vorliegen. Eine Umschaltung kann auf der
[Files/Download](userdoc/downloadpage.md#mbtiles) Seite
erfolgen. MbTiles können z.B. direkt von [OpenSeamap](https://ftp.gwdg.de/pub/misc/openstreetmap/openseamap/charts/mbtiles/)
heruntergeladen werden.  
Für die Nutzung der Vektorkarten siehe die [ocharts](hints/ocharts.md)/[ochartsng](hints/ochartsng.md) Plugin Beschreibungen.

Kartenquellen {: #sources}
--------------------------

Man kann Karten aus verschiedenen Quellen beziehen - entweder direkt in
einem von AvNav nutzbaren Format (gemf, mbtiles, o-charts) oder in einem
Format, das erst noch umgewandelt werden muss(z.B. BSB - .kap Dateien oser
s57).

Es sind auch Tools verfügbar, um solche Karten innerhalb oder außerhalb
von AvNav herunterzuladen.

Eine Liste von Kartenquellen:

* Download von fertigen Rasterkarten (z.B. von [OpenSeamap](https://ftp.gwdg.de/pub/misc/openstreetmap/openseamap/charts/mbtiles/)
  , [NOAA](https://distribution.charts.noaa.gov/ncds/index.md)
  - mbtiles)
* Download mit dem [Mobile
  Atlas Creator](http://mobac.sourceforge.net/).
* Download von BSB (KAP) Karten und Konvertierung in AvNav
* Download von Karten in AvNav mit dem [Mapproxy](https://github.com/wellenvogel/avnav-mapproxy-plugin)
  Plugin
* Kaufen von Karten bei [o-charts](https://o-charts.org/)
  und Nutzung mit dem [ocharts](hints/ocharts.md)/[ochartsng](hints/ochartsng.md)
  Plugin
* Download von S57 und Konvertierung/Nutzung mit dem [ochartsng](hints/ochartsng.md)
  plugin
* Nutzung von Karten vom [SignalK
  Chart Provider](https://github.com/SignalK/charts-plugin)   (wenn die [SignalK-Integration](hints/CanboatAndSignalk.md#SignalK) aktiv ist).
* Nutzung von online Kartenquellen wenn sie das default url Format
  unterstützen. Das kann man in einer xml Datei konfigurieren. Ein
  Beispiel findet man unter der [Online
  source für OpenSeaMap](https://github.com/wellenvogel/avnav/blob/master/viewer/demo/osm-online.xml).
* ...

Installation von Karten {: #installation}
-----------------------------------------

Nach der Installation sind in AvNav zunächst nur einige Online-Demo-Karten vorhanden. Zur realen Nutzung müssen die Karten
zunächst bei AvNav installiert werden.  
Die Karten können direkt in der WebApp hochgeladen werden.

Der Weg dafür hängt vom Kartentyp ab.

### Direkt nutzbare Karten (gemf,mbtiles)

Das Hochladen erfolgt auf der [Files/Download
Seite](userdoc/downloadpage.md#chartupload).  
Unter Android können sie auch in das externe Kartenverzeichnis kopiert
werden (nur gemf Karten).  
Für mbtiles bitte auch diesen [Hinweis
auf der Files/Download Seite](userdoc/downloadpage.md#mbtiles) beachten.

### Karten mit Konvertierung (kap, s57)

In den normalen Versionen (nicht Android) können ab 20200325 auch Karten,
die erst noch konvertiert werden müssen, über den [Importer](userdoc/importerpage.md)
hochgeladen werden.  
s57 Karten erfordern dabei ein installiertes [ochartsng](hints/ochartsng.md)
plugin.  
Es sollte beachtet werden, dass die Konvertierung ein rechenintensiver
Prozess sein kann, der auf einem Raspberry Pi viele Stunden dauern kann.
Das sollte daher ggf. auf einem Desktop-Rechner erfolgen.  
Da die Konvertierungsfunktion unter Android nicht zur Verfügung steht,
sollte hierfür AvNav noch einmal auf einem Linux- oder Windows-System [installiert](install.md) werden, um dort die Konvertierung
durchzuführen. Die erzeugten Dateien können dann direkt im Importer
heruntergeladen und unter Android installiert werden.

### Vektorkarten (o-charts, s57)

Diese Karten erfordern ein installiertes [ocharts](hints/ocharts.md)/[ochartsng](hints/ochartsng.md) Plugin (unter Android die
avocharts app - siehe [ochartsng](hints/ochartsng.md#android)).
Für Windows können diese nicht genutzt werden, da die Plugins nicht für
Windows bereitstehen (außer dem Konverter von S57 nach Ocharts). Für
Details siehe die [ocharts](hints/ocharts.md)/[ochartsng](hints/ochartsng.md)
Beschreibungen. S57-Karten, die über den Importer hochgeladen wurden,
werden sofort im [ochartsng](hints/ochartsng.md) Plugin
aktiv.

### Download von Karten in AvNav

Wenn das [MapProxy
Plugin](https://github.com/wellenvogel/avnav-mapproxy-plugin) installiert ist, werden dessen Karten in AvNav sofort
sichtbar und müssen nicht getrennt installiert werden.

Overlays {: #overlays}
----------------------

Ab Version 20201219 kann AvNav über (und unter) den eigentlichen Karten
noch weitere Informationen anzeigen, bzw. Karten können kombiniert werden.

Für Details siehe [Overlays](hints/overlays.md).

Download von Karten
mit dem Mobile Atlas Creator {: #Convert}
-------------------------------------------------------------

Für die Nutzung des [Mobile Atlas
Creators](https://mobac.sourceforge.io/) ist außer Java und dem MOBAC selbst keine weitere Software
auf dem PC/Laptop nötig. Man muss beim Download der Karten allerdings ein
gewisses Schema einhalten, damit die Karten in das oben beschriebene
Layer-Konzept passen und die Datenmengen überschaubar bleiben.

Dazu sollte man (je nach Kartenquelle) z.B. 3 Layer vorsehen: Übersicht(
Zoom Level 7-10) Navigation (level 10-15), Details (Level 16-18).
Anschließend sollte man im MOBAC layerweise vorgehen. Dazu jeweils als
gewünschte Zoom Level die zum Layer gehörigen anklicken (links oben),
danach alle Teilbereiche jeweils markieren und unter einem beliebigen
Namen dem Atlas hinzufügen. Das jeweils für die anderen Layer wiederholen
(dabei sinnvolle Auswahlen treffen). Anschließend sollte man die
Atlas-Konfiguration unter einem beliebigen Namen speichern - die kann man
ggf. noch für weitere Versuche brauchen. Als output-Format OsmDroid GEMF
(File->convertAtlasFormat) wählen und die Atlas-Erzeugung starten. Im
output-Verzeichnis entsteht eine xxx.gemf Datei. Diese auf den Raspberry [installieren](#installation).   
Auf der [Mapsources Seite](mapsources.md) sammle ich Chart
Sources für den Mobac, die für uns nützlich sein könnten.