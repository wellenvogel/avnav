---
  tags:
    - Karten
    - Vektorkarten
    - S57
    - ocharts
    - Plugin

---

# Avnav Ocharts(NG)

*AvNav O-ChartsNG* ist eine neue Implementierung als Ersatz für das legacy *AvNav
O-Charts* Plugin.  
Das Plugin hat eine Reihe von neuen Funktionen:

* Es läuft jetzt auch unter [Android](#android)
* Es gibt eine direkte Onlineverbindung zum O-Charts Shop
* Es können jetzt auch unverschlüsselte S57-Karten verwendet werden
  (nach einer einmaligen [Konvertierung](#chartconversions))
* Die Anzeige kann noch differenzierter angepasst werden
* Es werden keine großen Disk-Caches mehr angelegt. Das verringert die
  Schreiblast auf der SD-Karte und die CPU-Last.
* Es braucht keinen Restart mehr, wenn neue Karten hinzugefügt werden.
* Es können mehr Prozessorkerne genutzt werden, daher sollte es auf den
  meisten Systemen schneller laufen.
* Es werden wesentlich weniger externe Pakete benötigt, insbesondere
  auch keine lauffähige X11-Umgebung.
* Es wird weniger Speicher benötigt.

Gegenüber dem alten O-Charts Plugin gibt es die
folgenden Einschränkungen:

* **Es können keine oeRNC-Karten (Rasterkarten
  von O-Charts) gelesen werden**
* Karten von OpenCPN können nicht direkt genutzt werden. Da OpenCPN
  keine definierte Struktur seiner Konfiguration bietet, müssen die Karten
  noch einmal parallel im Plugin installiert werden. Außer auf Android
  wird allerdings der gleiche Key genutzt.

## Übersicht

AvNav kann direkt Karten in verschiedenen Rasterformaten verarbeiten. Für offizielle Seekarten im Vektor-Format gibt es die Firma [O-Charts](https://o-charts.org/),
die Karten für viele Gebiete der Erde für OpenCPN bereitstellt.

Nach einigen Absprachen mit der Firma können diese Karten mit diesem Plugin nun auch für
AvNav genutzt werden.

Es können die oeSENC Vektor-Karten genutzt werden.   
Außerdem kann das Plugin nach einer [Konvertierung](#chartconversions) freie S57-Karten nutzen .

Die Umwandlung in die für AvNav notwendigen Raster-Karten erfolgt dabei
im laufenden Betrieb immer dann, wenn die Karten dargestellt werden
sollen. Ein gewisser Teil der Kartenkacheln wird im Server im Speicher
aufbewahrt, sodass diese sehr schnell erneut bereitgestellt werden können.
Das beschleunigt die Anzeige, wenn man zwischen verschiedenen Zoomstufen
wechselt oder mehrere Displays angeschlossen sind.

Das Handling der Karten erfolgt dabei vollständig durch das Plugin - das
betrifft auch die Installation.

Die Karten müssen über

{{MM("MMchartspage")}} -> ![](../../img/icon-ochartsng.svg){: .inline-image }

und damit über die hier beschriebene Oberfläche des Plugins installiert werden. Ein Hochladen unter `Charts` oder  `Import` funktioniert nicht!

![](../../img/ochartsng-gui1.png)
///caption
OchartsNG Oberfläche
///

## Einführung

In der Einführung zur [Navigationsseite](../base/navpage.md) und auch im dortigen Video werden wichtige Grundfunktionen bereits einmal erklärt. In diesem Kapitel werden diese Informationen ergänzt und detailliert erklärt.
  

## Karten Typen

AvNav O-ChartsNG kann die O-Chart Vektorkarten darstellen (oeSENC) - so
wie in diesem Dokument beschrieben.  
Außerdem können unverschlüsselte Vektorkarten (S57) benutzt werden. Diese
sind für verschiedene Regionen frei zum Download verfügbar.  
Um solche S57-Karten nutzen zu können, müssen sie zunächst in das genutzte
OpenCPN SENC-Format umgewandelt werden.  
Für eine Anleitung zur Konvertierung siehe [Kartenkonvertierungen](#chartconversions).

## Erwerb und Installation der Karten {: #Charts}

**Wichtiger Hinweis**: Wenn man keinen Dongle von O-Charts hat, sind die Karten an das System gebunden. Wenn es daher beim Einbringen oder bei der Nutzung der Karten Probleme gibt, bitte **nicht** das System neu aufsetzen - sondern eine Reparatur versuchen. Wenn man
das System neu aufsetzt, werden u.U. die Lizenzen ungültig. Ich helfe
gerne bei Problemen - Kontakt z.B. per [email](mailto:andreas@wellenvogel.net).

Nur bei Nutzung der AvNav Images ist auch ein Update der Images möglich.
Bitte im Zweifel vorher testen.

Um im O-Charts-Shop Karten kaufen zu können, muss [dort](https://o-charts.org/shop/de/autenticacion?back=my-account) zunächst ein Konto angelegt werden.  
Anschließend muss man seine Systeme, auf denen man die Karten nutzen möchte,
[auf der Seite von o-charts](https://o-charts.org/shop/en/8-oesenc) registrieren.

Für den gesamten Prozess gibt es zwei Wege - den "[Online-Prozess](https://o-charts.org/manuals/?lng=en) " und den ["Offline-Prozess"](https://o-charts.org/manuals/offline.php?lng=en) .   
Der Online-Prozess erfordert, dass das System, auf dem der AvNav Server
läuft , mit dem Internet verbunden ist. Das muss nicht das System sein, auf dem der Browser läuft.
Für Android ist die Registrierung eines neuen Systems nur über den Online-Prozess möglich.

### Der Offline-Prozess {: #offlineprocess}

**Nicht für Android - dort bitte den [Online-Prozess](#onlineprocess) nutzen**

Dieser besteht aus den folgenden Schritten:

1. Erzeugung eines "Fingerprints" für das System, auf dem die Karten
   genutzt werden sollen. Dieser kann in AvNav über die Bedienoberfläche
   des Plugins erzeugt und heruntergeladen werden.
2. Hochladen dieses Fingerprints zu O-Charts und Anlegen eines Systems
   (im Wesentlichen Vergabe eines Namens)
3. Kaufen von Karten
4. Zuordnen zu dem angelegten System
5. Nach kurzer Zeit gibt es eine Mail von O-Charts mit einem
   Download-Link für die Karten (Zip-File)
6. Hochladen der Karten in AvNav wieder über die Bedienoberfläche des
   Plugins.

Für Updates werden die Schritte 4,5 und 6 wiederholt (bei 4 nur
Anforderung des Updates).

Für weitere Kartensätze reichen die Schritte 3-6.

Für die Schritte 2,3,4 und 5 wird natürlich ein System mit
Internet-Verbindung benötigt. Das kann z.B. ein Laptop oder auch ein Android
Tablet sein.  


**Wichtiger Hinweis für Android**: Die Registrierung eines Systems (Schritte 1 und 2) können nur im [Online-Prozess](#onlineprocess) erledigt werden.

Für den Ablauf des Offline-Prozesses habe ich ein [Video](https://www.youtube.com/watch?v=q24VRAtbbEE) gemacht, um ihn zu verdeutlichen. Hier noch einmal eine kurze Beschreibung
dazu.

**Hinweis**: Wenn die Karten auf dem gleichen System bereits für OpenCPN registriert sind, dann kann man direkt mit Schritt 6 starten Das gilt nicht für Android - dort kann für OpenCPN und AvNav nicht die gleiche Lizenz genutzt werden.

#### Erzeugung des Fingerprints

Über 

{{MM("MMchartspage")}} -> ![](../../img/icon-ochartsng.svg){: .inline-image }

auf die Oberfläche des Plugins gehen, dort den Tab "Charts" auswählen.

![](../../img/ochartsng-gui-charts1.png)

Mit "Get Fingerprint" die Erzeugung des Fingerprints anstoßen. Falls man
einen Dongle von O-Charts benutzt, den Fingerprint über "Get
Fingerprint(Dongle)" erzeugen. Dieser wird nur sichtbar, wenn ein Dongle
erkannt wurde (Dongle-Zeile grün).

![](../../img/ochartsng-gui-charts2.png)

Im Dialog die erzeugte Datei auf dem eigenen Gerät speichern.

#### Hochladen des Fingerprints zu O-Charts

Auf die [O-Charts-Seite](https://o-charts.org/shop/en/8-oesenc)
gehen und den Fingerprint hochladen.

![](../../img/ocharts-buying.png)

Mit "Choose File" die unter 2. gespeicherte Datei wählen. Dazu einen
sinnvollen Namen vergeben (dieser findet sich später in den Mails mit den
Download Links).

#### Kaufen von Karten

Bei O-Charts aus den verfügbaren [oeSENC Karten](https://o-charts.org/shop/de/8-oesenc) die gewünschten kaufen.

#### Zuordnen zum angelegten System

![](../../img/ocharts-assign.png)

Bei 1 kann die Zuordnung zu einem bereits angelegten System erfolgen (hier nicht
mehr möglich, weil die Karten bereits zu den 2 maximal verfügbaren
Systemen zugeordnet sind). Bei 2 wird dann die Mail mit dem Download-Link
angefordert. Das erfolgt auch bei Updates - hier im Bild zu sehen: Die
letzte abgerufene Version ist 21, verfügbar ist 23.

#### Herunterladen der Karten

![](../../img/ocharts-download.png)

Nach kurzer Zeit erhält man von O-Charts eine Mail mit dem Download-Link für die gekauftre Karte.
Diese Datei (zip) herunterladen.

#### Hochladen der Zip-Datei zu AvNav

![](../../img/ochartsng-upload1.png)

In der Oberfläche des O-Chart Plugins über "Upload Zip" die im Schritt 5.
heruntergeladene Datei zu AvNav hochladen.   
Während des Uploads wird ein Fortschritt angezeigt.

![](../../img/ochartsng-upload2.png)

Am Ende des Uploads wird auf dem AvNav Server die Datei ausgepackt und
es werden einige Prüfungen durchgeführt. Das kann einige Sekunden dauern.

Die Karten werden, falls nicht anders konfiguriert, in das Verzeichnis
*/home/pi/avnav/data/ocharts/charts* hochgeladen.

Wenn die neu hochgeladenen Karten ein Update für einen bereits
existierenden Kartensatz enthalten, wird der existierende Satz
deaktiviert. Das kann man später mit *Enable/Disable/Auto* ändern.
Kartensätze, die nicht mehr benötigt werden, können gelöscht werden.

Wichtiger Hinweis: Die Karten stehen im eigenen Account auf der O-Charts Seite nur während ihres Gültigkeitszeiraumes (1 Jahr) zum Download bereit. Daher sollte die Zip-Datei noch einmal sicher aufbewahrt werden. Man kann diese auch zu AvNav hochladen und nutzen, wenn der
Gültigkeitszeitraum abgelaufen ist. Man hat dann natürlich keine Updates
mehr.

Wenn alle Karten erfolgreich eingelesen wurden, wird der Status sich zu
grün ändern (READY).

![](../../img/ochartsng-upload4.png)

Falls der Status auf "ERROR" (rot) wechselt, wurde u.U. ein Zip-File hochgeladen,
was einem anderen System zugeordnet war. Details kann man im Log File
(/home/pi/avnav/data/ocharts/provider.log) sehen.

Nach erfolgreichem Einlesen sind die Karten verfügbar und erscheinen auf der Navigationsseite in der Kartenauswahl-Liste.

{{MM("MMnavpage")}}->{{BT("NavSelectChart")}}

### Der Online-Prozess {: #onlineprocess}

**Für Android muss vorher die AvOcharts App installiert werden - siehe die [Hinweise für Android](#android)**

Damit man den Online-Prozess nutzen kann, muss das System, auf dem AvNav
läuft (der Server, nicht nur ein Client im Browser!) mit dem Internet verbunden sein.

Der Prozess erlaubt es, ein System zu registrieren, zu prüfen, ob das
aktuelle System im Shop bekannt ist, und sich die Karten, die diesem System
zugeordnet wurden, anzeigen zu lassen. Man kann diese dann direkt
herunterladen und installieren.  
Das eigentliche Kaufen der Karten und die Zuordnung zum System muss über
die Webseite des O-Charts Shop vorgenommen werden. In der O-ChartsNG-Weboberfläche
ist ein Link-Button vorhanden, der direkt zum Shop verbindet.  
AvNav O-ChartsNG speichert keine Login-Daten für den Shop. Da aber die
Applikation im Browser läuft, können die Login-Daten dort gespeichert
werden wie auch für jede andere Webseite.

**Sicherheitshinweis**: Die Kommunikation zwischen AvNav O-ChartsNG und dem O-Charts Shop ist verschlüsselt. Die Kommunikation zwischen dem Browser und dem AvNav Server aber nicht. Daher
darf der Online-Prozess nur verwendet werden, wenn man sich in einem
sicheren WLAN befindet, z.B. hinter einem LTE Router oder einem mobilen
Hotspot - niemals aber direkt in einem öffentlichen WLAN, wenn der Browser
und der Server nicht auf dem gleichen Rechner laufen.

![](../../img/ochartsng-shop1.png)

Wenn man den "Shop"-Reiter öffnet ist man zunächst nicht im Shop
eingeloggt. Man kann sehen, ob momentan ein Dongle aktiv ist oder nicht.
Über den "ShopPage" Button gelangt man direkt zur O-Charts Webseite, aber
es macht mehr Sinn, sich zunächst einzuloggen.

Mit einem Klick auf "Login" und Eingabe von Nutzername und Passwort
loggt man sich im O-Charts Shop ein.

![](../../img/ochartsng-shoploggedin.png)

Wenn das System bereits im Shop registriert wurde, wird der "Shop name", d.h. der dort genutzte Name für das System, angezeigt. Ebenso wird die Liste der Karten/Updates, die dem System zugeordnet wurden, angezeigt(siehe [Offline-Prozess](#offlineprocess)).  
Wenn die Version einer Karte im Shop neuer ist als die lokale oder eine
Karte lokal noch nicht vorhanden ist, kann man sie direkt installieren.

![](../../img/ochartsng-shopupdate.png)

![](../../img/ochartsng-shopdownload.png)

Nach dem Herunterladen wird die Karte entpackt und kann sofort genutzt
werden. Wenn es ein Update für eine existierende Karte ist, wird die neue
Version aktiv und die alte wird "disabled". Das entspricht dem Verhalten wie beim
Hochladen einer Karte. Auf dem "Charts"-Reiter kann man später die alte
Version löschen, wenn man sie nicht mehr benötigt.

**Wichtiger Hinweis**:  
Die Karten im Shop bleiben nur während ihrer Gültigkeitsdauer (1 Jahr)
verfügbar. Bitte daher die Karten noch einmal lokal sicher aufbewahren.
Das kann man entweder durch Anforderung auf der Shop-Webseite tun wie im
Offline-Prozess) oder man kann die ZIP-Datei direkt vom "Charts"-Reiter
herunterladen.

Wenn das System im Shop noch nicht bekannt ist, kann man es hier registrieren:

![](../../img/ochartsng-shopunknown.png)

Auf einem Linux-System wird man nach einem Namen für das System gefragt,
unter Android ist der Name voreingestellt und kann nicht geändert werden.  

Wenn man das System registriert hat, kann man über "ShopPage" direkt zur
Shop-Webseite gehen und Karten kaufen bzw. zuordnen. Wenn man von dort
zurückkehrt, muss man über "Refresh" die Liste der zugeordneten Karten
aktualisieren.

## Anpassung des Aussehens {: #MainSettings}

Da die O-Charts-Karten als Vektorkarten vorhanden sind, kann in weiten
Bereichen das Aussehen der Karten angepasst werden. Dabei sind allerdings
einige Einschränkungen zu beachten:

1. Die Anpassung erfolgt auf der Server-Seite und ist damit für alle
   verbundenen Displays gleichartig wirksam
2. Wenn das Aussehen geändert wird, werden die im internen Cache
   gespeicherten Kartenkacheln gelöscht, sodass es auf langsamen Systemen
   danach leichte Verzögerungen geben kann.

Die Veränderung der Parameter erfolgt über die Oberfläche des Plugins

{{MM("MMchartspage")}} -> ![](../../img/icon-ochartsng.svg){: .inline-image }

Reiter "Main Settings".

![](../../img/ochartsng-settings1.png)
Wenn eine Einstellung geändert wird (1), wird der Parameter fett dargestellt. Die Änderungen werden
erst wirksam, wenn "Update Settings"(2) angeklickt wurde.

Mit *Cancel* können die Änderungen zurückgenommen werden, der Button *Defaults* setzt
die Einstellungen auf Default-Werte. Die Parameter entsprechen weitgehend
den bei [OpenCPN vorhandenen Settings](https://opencpn.org/wiki/dokuwiki/doku.php?id=opencpn:opencpn_user_manual:options_setting).

Die folgende Tabelle listet die Einstellungen.

| Name | Bedeutung | Default |
| --- | --- | --- |
| Show Text | Zeige Texte zu den Objekten auf der Karte | an |
| Important Text Only | Verbirg weniger wichtige Texte | aus |
| Light Descriptions | Beschreibungen für Feuer | an |
| Show Depths | Zeige Tiefenwerte | an |
| Show Quality | Zeige Extra-Objekte für die Karten-Qualität | aus |
| Chart Information Objects | spezielle Objekte auf der Karte | an |
| Buoy/Light Labels | Bezeichnungen für Feuer/Tonnen | an |
| National text on chart | Nationale Texte | an |
| Show Lights | Zeige Feuer | an |
| Show Anchor Info | Zeige Informationen über den Ankergrund | an |
| Color Scheme | Das Farbschema für die Darstellung | DAY\_BRIGHT |
| Chart Bounds | Zeige die Ränder der Karten | an |
| Reduced Detail at Small Scale | Reduziere die Details auf geringeren Zoom-Leveln | an |
| De-Cluttered Text | Bessere Anordnung der Texte | an |
| Display Category | Art der Darstellung (Base, Standard, All, User Standard) | Standard |
| Graphics Style | Grafische Darstellung (Paper Chart, Simplified) | Paper Chart |
| Boundaries | Art der Begrenzungen (Plain, Symbolized) | Plain |
| Colors | 4Color, 2 Color | 4 Color |
| Text Font Size | Skalierung für die Text-Grösse | 1 (ca. 12px) |
| Soundings Font Size | Skalierung für die Tiefenangaben | 1 (ca. 12px) |
| Scale | Basisskalierung. Höhere Werte sorgen für mehr Details auf kleineren Zoom-Stufen | 1 |
| UnderZoom | Anzahl der Zoomstufen, die eine höher aufgelöste Karte verkleinert wird, wenn auf dem gewünschten Level keine Karte vorhanden ist | 4 |
| AreaUnder | Wenn im Bereich "UnderZoom" immer noch keine Karte für den Bereich gefunden wurde, benutze weitere (höhere) Zoom Level. Für diese Karten werden dann nur Umgebungsumrisse (Land, Tiefe) angezeigt - keine weiteren Informationen.  Vorsicht beim Umgang mit dieser Einstellung, sie kann die Darstellungsleistung stätrker beeinflussen. | 2 |
| OverZoom | Anzahl der Zoomstufen, die eine niedriger aufgelöste Karte vergrößert wird,wenn es keine besser aufgelöste Karte gibt.  **Hinweis**: UnderZoom,AreaUnder und OverZoom bestimmen maßgeblich, wie aufwändig der Render-Vorgang ist, d.h. wieviele Karten an der Erzeugung einer Kachel beteiligt werden müssen. Kleinere Werte führen zu weniger Karten (schneller) können aber in bestimmten Bereichen zu weißen Flächen zwischen Karten-Teilen führen. Die Defaults sollten ein guter Kompromiss sein. | 4 |
| Scale Tolerance | Wenn die Symbole in unterschiedlichen Größen benötigt werden oder die Karte skaliert wird, müssen jeweils neue Symbole intern berechnet werden. Mit einer Toleranz kann man die Anzahl dieser Neuberechnungen etwas verringern. | 0.1 |
| Rotation Tolerance | Auf der Karte werden viele Objekte (insbesondere auch Linien) in verschiedenen Rotations-Winkeln benötigt. Um die Zahl der zu erzeugenden Objekte zu verringern, macht eine gewisse Toleranz für den Winkel Sinn. | 2 |
| SymbolScale | Skalierung der Symbolgrößen. Da einige Symbole auf Raster-Bildern basieren, ist eine Skalierung > 2 meist nicht sinnvoll. | 1 |
| Depth | Einheit für die Tiefenangaben (Meters, Feet, Fathoms) | Meters |
| Shallow Depth | Tiefe für Flachwasser | 2 |
| Safety Depth | Tiefe für Sicherheits-Kontur | 3 |
| Deep Depth | Tiefe für Tiefwasser | 5 |

Unter dem Tab "Detail Settings" können gezielt einzelne Karten-Features
an- oder abgeschaltet werden. Diese Einstellungen werden nur im
Anzeige-Modus "User Standard" wirksam.

## Feature Info (Objektabfrage) {: #featureinfo}

Wenn man auf die Karte klickt, bekommt man die [Feature Info](featureinfo.md) von AvNav. Wenn man eine O-Charts Karte nutzt und in der Liste das Kartensymbol anklickt, bekommt man die aktuell wichtigste Information in der Nähe des Klick-Punktes (Tonne, Feuer).

![](../../img/ochartsng-featureinfo1.png)

Über "Info" können die Roh-Informationen der Karten angezeigt werden.

![](../../img/ochartsng-featureinfo2.png)

Mit einem Klick auf den (blauen) Karten-Namen bekommt man einige weitere
Informationen zur Karte.

![](../../img/ochartsng-featureinfo3.png)

Mit dem Button "Charts" kann man sich eine Liste der an dieser Stelle
genutzten Karten anzeigen lassen.  
Mit dem Schalter "RenderedOnly" werden nur die Objekte aus den Karten in der
Liste angezeigt, die auch momentan im Bild dargestellt wurden. Sonst werden
alle Objekte in der Nähe des Klicks angezeigt.  

## Installation {: #Installation}

### Linux/Raspberry

Das Plugin ist als Debian-Paket vorhanden.  
Es ist in den normalen Repositories(Verzeichnissen) vorhanden.

Für die [AvNav Images](../installation/raspberry.md) ist das Paket

* avnav-ochartsng

bereits installiert.

Wenn man es direkt von der Kommandozeile machen möchte, kann man das mit
den folgenden Kommandos tun:


```
sudo apt-get update  
sudo apt-get install avnav-ochartsng  
sudo systemctl restart avnav
```
Zu allgemeinen Hinweisen für die Installation von AvNav-Paketen siehe die [Installationsbeschreibung](../installation/linux.md).

Alternativ kann man die Pakete auch aus dem [Daily
Builds Verzeichnis]({{DLLINK("daily-ochartsng")}}) bzw. [Release
Verzeichnis]({{DLLINK("release-ochartsng")}}) herunterladen und installieren.

Das kann man z.B. mit den folgenden Kommandos tun (die Version durch die
gewünschte ersetzen):

```
cd /home/pi/avnav  
wget -O avnav-ochartsng_20260703-raspbian-trixie_arm64.deb https://www.wellenvogel.net/software/avnav/downloads/daily-ochartsng/20260703/avnav-ochartsng_20260703-raspbian-trixie_arm64.deb  
sudo apt install  ./avnav-ochartsng_20260703-raspbian-trixie_arm64.deb
sudo systemctl restart avnav
```

Man kann natürlich auch die Pakete zunächst auf einen PC herunterladen
und sie von dort z.B. mit WinSCP auf den Raspberry Pi übertragen und dann
dort installieren.

#### AvNav-ocharts und AvNav-ochartsng zusammen

Wenn man das O-ChartsNG Plugin installiert, benutzt es initial einen
anderen Port (8083)  als das alte Plugin (ocharts), sodass es keine Konflikte
gibt.
Falls man ein Update auf einem älteren System vornimmt, auf dem noch das ocharts-Plugin installiert ist, sollte man es unter

{{MM("MMpluginspage")}}

disablen.

Im neuen Plugin kann man den Schalter "useLegacy" aktivieren (in der [Plugin
Konfiguration](#PluginConfig)). Ist dieser Schalter aktiviert, benutzt das neue
Plugin auch alle Karten, die vorher mit dem alten installiert wurden.
Alternativ kann man die Karten auch erneut zum neuen Plugin hochladen oder direkt aus dem Shop, wenn sie noch gültig sind.

Wenn man beide Plugins parallel nutzen möchte, sollte das System über ausreichend RAM verfügen (2GB).

### Android 

Für Android git es eine eigene App (avocharts) die O-ChartsNG enthält.
Diese muss separat installiert werden.

Siehe [AndroidApp](#android) weiter unten..

## Releases {: #Releases}

Alle Releases und alle Beta-Versionen (Entwicklerversionen oder Daily
Builds) findet man unter:

* [Releases]({{DLLINK("release-ochartsng")}})
* [Daily Builds]({{DLLINK("daily-ochartsng")}})



### Release-Versionen

20260703 [link]({{DLLINK("release-ochartsng/20260703")}})

Vorbereitung für neue AvNav-Versionen

Die Hinweise zu älteren Versionen findet man in der [alten Dokumentation]({{OLDLINK("hints/ochartsng.html#Releases")}}).


## Lizenzhinweise {: #License}

Die Nutzung der Karten für AvNav mit dem oeSENC-pi Plugin ist so mit
O-Charts diskutiert und abgestimmt worden und damit legal im Sinne der
Lizenzen.  
Die [Lizenzbedingungen](https://o-charts.org/manuals/docs/EN_rrc_eula_ChartSetsForOpenCPN.md)
von [O-Charts](https://o-charts.org/shop/en/content/3-our-conditions)
sind dabei unbedingt zu beachten. Es ist insbesondere nicht gestattet, die
Karten zu kopieren oder auf anderen als den lizensierten Systemen
einzusetzen.

Der Zugriff auf die Karten innerhalb von AvNav ist nur aus dem lokalen
Netz möglich, maximal können 5 Geräte (Clients) gleichzeitig die O-Charts
von einem AvNav Server nutzen.

Für die Software-Lizenzen siehe die [Readme.](https://github.com/wellenvogel/ochartsng/blob/master/Readme.md)

## Plugin-Konfiguration {: #PluginConfig}

**Nur unter Linux.**
 Für Android siehe [Android/Settings](#androidsettings).  
Einige Einstellungen für das Plugin können unter

{{MM("MMpluginspage")}}

angepasst werden.

![](../../img/ochartsng-plugin1.png)

Über "Config" kann man die Einstellungen des Plugins anpassen.

![](../../img/ochartsng-plugin2.png)

| Name | Bedeutung | Default |
| --- | --- | --- |
| port | Http Port | 8083 |
| debug | Level für das Logging, 0-ERROR,1-INFO,2-DEBUG | 1 |
| memPercent | Der prozentuale Anteil des Systemspeichers, den der Provider maximal nutzen soll. Wenn man diesen nicht oder zu klein setzt, berechnet der Provider intern einen Minimalwert und nutzt diesen. Der kann u.U. insbesondere bei der Nutzung von Rasterkarten sehr klein sein und den Rechner damit zwingen, ständig Karten-Dateien zu öffnen und zu schließen - was die Geschwindigkeit stark reduzieren kann. Wenn man ausreichend Speicher hat (z.B. > 2GB), wird das Arbeiten beschleunigt, wenn man  den Speicher auf 1GB setzt. | 50 |
| tileCachekb | Speicher in KB für die Speicherung von bereits erzeugten Karten-Kacheln (mit  0 erfolgt keine interne Speicherung) | 40960 |
| useLegacy | Nutze auch die Karten, die mit dem alten avnav-ocharts-Plugin installiert wurden. | aus |

## Android App {: #android}

AvNav OchartsNG steht auch für Android zur Verfügung und stellt die
Karten für die [AvNav Android App](../installation/android.md)
bereit.  
Man muss dazu die separate Android App  ["avocharts"](https://play.google.com/store/apps/details?id=de.wellenvogel.ochartsprovider) installieren.

![](../../img/ochartsng-android-main.png)

Wenn man die App startet, kann man zunächst einige Einstellungen anpassen.  
Wenn man dieses Bild sieht (Status rot), läuft der eigentliche Karten-Server
noch nicht. Dieser wird erst durch Klick auf "Start" gestartet.

Später wird es normalerweise nicht mehr
nötig sein, die avocharts App separat zu starten. Das wird automatisch
erfolgen, sobald AvNav startet. Aber mit einem direkten Start kann man
unter Umständen Fehler erkennen, indem man die Ausgabe ("OUT") oder die
Logdatei ("LOG") anschaut.  
**Bitte beachten**: Der automatische Start funktioniert nur bei Apps
vom gleichen Typ - d.h. eine AvNav Release App kann nur eine avocharts
Release App starten, eine AvNav Beta App eine avocharts Beta App.  
Wenn man also die avocharts Beta App installiert und mit AvNav (release - aus
dem Store) nutzen möchte, muss man avocharts per Hand starten und auch
noch einmal auf "START" klicken.
{: #androidstartup}

### Einstellungen {: #androidsettings}

Um Einstellungen anzupassen, kann man auf die angezeigten Einstellungen
oder auf das Einstellungssymbol (oben rechts) klicken.

![](../../img/ochartsng-android-settings.png)

  
| Name | Bedeutung | Default |
| --- | --- | --- |
| Port | Der HTTP Port, den der Karten-Server nutzen wird. Wenn man beim Start Fehlermeldungen bekommt und unter "OUT" so etwas wie "address already in use" sieht, muss man diesen Port ändern. | 8083 |
| LogLevel | 0 - errors, 1- info, 2- debug | 1 |
| Workdir | Das [Arbeitsverzeichnis](#workingdirectory) für Karten, Logs und Einstellungen | internal |
| Shutdown | Zeit (in s), die der Karten-Server auf ein Signal von AvNav (Heartbeat) wartet, bevor er automatisch stoppt (das ist nur aktiv, wenn avocharts automatisch durch AvNav gestartet wurde) | 30 |
| Memory | Erlaubte Speichernutzung (in %) vom Systemspeicher (RAM) | 50 |
| Testmode | für interne Tests | aus |
| Use alt key | Siehe unten [Hinweise](#androidbetarelease) über Release/Beta-Versionen |  |
| Disk symbol (upper right) | Key speichern (Siehe unten [Hinweise](#androidbetarelease) über Release/Beta-Versionen) |  |

Wenn man die Einstellungen fertig angepasst hat, geht man mit dem Pfeil
zurück wieder auf die Hauptseite.

### Arbeitsverzeichnis {: #workingdirectory}

AvOcharts speichert Karten, Logs und die Einstellungen von *Main Settings*
und *Detailled Settings* unter einem Verzeichnis auf dem Gerät. (Working
Directory). Dieses Verzeichnis ist unabhängig vom [AvNav Arbeitsverzeichnis](../installation/android.md#android-main-einstellungen).

Man hat die folgende Auswahl:

![](../../img/ochartsng-android-workdir.png)

Je nach Gerät können Sie verschiedene Speicherorte für Ihre Daten
auswählen (technische Informationen finden Sie in der [Android-Dokumentation](https://developer.android.com/training/data-storage/app-specific?hl=de)).
Wenn Ihr Gerät über eine SD-Karte verfügt, gibt es die oben gezeigte
Auswahl:

| Name | Bedeutung |
| --- | --- |
| Internal Storage | Dies ist ein Speicherort im internen Flash-Speicher Ihres Geräts. Er ist vollständig privat und (sofern Ihr Gerät nicht gerootet ist) nicht für andere Apps wie z. B. einen Dateimanager zugänglich. Dies ist die Standardeinstellung.  Die Zeichenfolge "\*" vor dem Eintrag zeigt, das das Verzeicnis bereits als Arbeitsverzeichnis genutzt wird und Daten enthält. |
| External Storage | Dieser Speicher befindet sich weiterhin im internen Flash-Speicher, wird jedoch vom Android-System anders behandelt und daher als "extern - emuliert" bezeichnet. Andere Apps können auf diesen Speicherort zugreifen.Der Pfad für einen Dateimanager lautet typischerweise [interner Speicher]/Android/data/de.wellenvogel.ochartsprovider.main/files (oder [interner Speicher]/Android/data/de.wellenvogel.ochartsprovider.main.beta/files für eine Beta-Version). |
| External Storage-1 | Dieser Pfad ist nur sichtbar, wenn Ihr Gerät eine SD-Karte installiert hat. Als Erklärung wird auch „removable [SD-Karte]“ angezeigt.  Falls verfügbar, befindet sich dieses Verzeichnis tatsächlich auf einer externen SD-Karte. Wenn Sie es verwenden möchten, muss die SD-Karte immer installiert ist, wenn avocharts (oder AvNav) läuft. Falls die SD Karten entfernt wird, während avocharts läuft, kann es zum Absturz kommen.  Andere Apps wie ein Dateimanager können auf die Daten zugreifen.  Der Speicherort ist [SD card]/Android/data/de.wellenvogel.ochartsprovider/files (or [SD card]/Android/data/de.wellenvogel.ochartsprovider.beta/files). |

Wenn man das Arbeitsverzeichnis ändert, werden alle Daten im alten
Arbeitsverzeichnis für avocharts unsichtbar. Sie bleiben jedoch verfügbar
und man kann jederzeit zum alten Verzeichnis zurückkehren.

Beim Start von avocharts wird geprüft, ob das ausgewählte
Arbeitsverzeichnis noch verfügbar ist. Man wird aufgefordert, ein
anderes Verzeichnis auszuwählen, falls nicht.  
Wenn avocharts durch Autostart von AvNav gestartet wird, versucht es einen
Fallback auf das interne Arbeitsverzeichnis, falls das gewählte nicht
verfügbar ist, weil z.B. die SD Karte entfernt wurde.

Für externe Verzeichnisse kann man grundsätzlich einen Dateimanager
verwenden, um Daten dorthin und von dort zu kopieren. Avocharts erkennt
diese Daten jedoch potenziell nicht, wenn es gerade läuft. Daher empfiehlt
es sich, die Daten direkt in der App hochzuladen. Man kann aber z.B. eine
Zip-Datei mit diesen Daten als Backup erstellen. Und man kann sehr einfach
die Log-Dateien von avocharts sehen.

Alle (potenziellen) Abrbeitsverzeichnisse werden gelöscht, wenn man
avocharts deinstalliert oder seine Daten löscht.

Hinweis: Einstellungen (aus der Tabelle hier darüber) werden nicht im
Arbeitsverzeichnis abgelegt.

### Erster Start

Man kann den Karten-Server mit "START" loslaufen lassen.

![](../../img/ochartsng-android-running.png)

Wenn der Server läuft, wird das in der Benachrichtigungszeile angezeigt.
Wenn der Start nicht erfolgreich ist (Status wird wieder rot), kann man in
die Ausgabe ("OUT") und in das Log ("LOG") schauen.

Ein Klick auf "APP" öffnet ein Browser-Fenster mit der O-ChartsNG-Seite -
die gleiche Ansicht, die man auch aus AvNav heraus bekommt. Das ist aber nur dafür gedacht, zu prüfen, ob alles korrekt läuft. Die eigentliche Nutzung sollte aus AvNav heraus erfolgen.


### Beta and Release Versionen {: #androidbetarelease}

Bedingt durch die Arbeitsweise des O-Charts Lizenz-Servers kann man
Karten, die man z.B. in der Beta-Version gekauft hat, nicht in der Release
Version verwenden und umgekehrt.  
Um das zu vermeiden, kann man die benötigte Lizenz-Information (Key) aus
der App exportieren und in der anderen Version wieder imprtieren. 

Hinweis: Man kann die Lizenz trotzdem nur auf dem jeweiligen Gerät nutzen!  
Um den Key zu exportieren, klickt man auf der Einstellungsseite oben
rechts auf das Disketten-Symbol und speichert ihn. Bitte auch an ein
Backup denken, ohne diesen Key kann man später in der anderen App-Version
die Karten nicht mehr nutzen. 

Wenn man später die andere Version der App nutzt, dann aktiviert man dort "use alternate key", klickt auf den *alternate key* und findet dort einen "Import" Button.  
Man kann leicht prüfen, ob man die korrekte Lizenz hat, indem man sich im
Shop anmeldet und prüft, ob das System korrekt erkannt wird - siehe [Online-Prozess](#onlineprocess).

Bitte auch die Hinweise zum [automatischen Start](#androidstartup) beachten.

## Technische Details

Die Karten werden durch einen Server (eigenes Programm) bereitgestellt.  
Die Kommunikation mit AvNav wird unter Linux durch ein AvNav [Plugin](plugins.md)
realisiert, auf Android durch die avocharts App .

Die Web-Oberfläche ist eine Reactjs App und wird auch durch den Server
bereitgestellt. In AvNav ist sie als User App integriert.

Der komplette Code findet sich auf [GitHub](https://github.com/wellenvogel/ochartsng).

Die Installation erfolgt (unter Linux) in /usr/lib/avnav/plugins/ochartsng. Das Daten-Verzeichnis ist /home/pi/avnav/data/ochartsng. Man kann einige weitere Parameter für das Plugin direkt in der [avnav_server.xml](configfile.md) setzen. Das sollte im Normalfall aber nicht nötig sein.

Man kann z.B. das Daten-Verzeichnis setzen.

```
<AVNPluginHandler>  
...  
<system-ochartsng dataDir="$DATADIR/ochartsng"/>  
</AVNPluginHandler>
```


### Kartenkonvertierungen {: #chartconversions}

Unverschlüsselte Vektorkarten wie S57 müssen vor der Benutzung in das verwendete interne "SENC" Format konvertiert werden.  
Dafür gibt es 2 Optionen:

#### Konvertierung mit AvNav

Das Avnav O-ChartsNG Plugin fügt einen Konverter zum [Importer von AvNav](charts.md#converter) hinzu. Dieser Konverter enthält ein Python Script, um S57 in ein Zip-Archiv umzuwandeln, was hochgeladen werden kann.  
Um die S57-Karten zu nutzen, kann man einfach ein Zip mit den S57-Karten
zum [Importer von AvNav](charts.md#converter) hochladen, nachdem O-ChartsNG installiert wurde.  
Wenn man AvNav und O-CchartsNG unter Linux nutzt, werden die Karten
automatisch in O-ChartsNG verfügbar, wenn die Konvertierung abgeschlossen
wurde.

Wenn man O-ChartsNG auf einem anderen System nutzen möchte (z.B. Android),
braucht man zusätzlich eine Installation von AvNav unter Linux
oder unter [Windows](../installation/windows.md).

O-ChartsNG selbst ist nicht unter Windows lauffähig, aber der Konverter
steht auch für Windows zur Verfügung. Nachdem man AvNav für Windows
installiert hat, muss man dort den "Update"-Dialog aktivieren und die URL
für den O-ChartsNG S57-Konverter für Windows angeben:

- Release: <https://www.wellenvogel.de/software/avnav/downloads/release-ochartsng/latest/ochartsng-latest.zip>
- Daily: <https://www.wellenvogel.de/software/avnav/downloads/daily-ochartsng/latest/ochartsng-latest.zip>

Danach lädt man die S57-Karten zum Konverter hoch und nachdem die
Konvertierung abgeschlossen wurde, lädt man die Zip-Datei mit den
konvertieren Karten herunter. Diese Zip-Datei kann dann direkt in
O-ChartsNG installiert werden (Linux und Android).

#### Konvertierung mit OpenCPN

Wenn man bereits einen Computer mit OpenCPN hat, kann man dort die Karten
konvertieren.   
Dafür aktiviert man die Karten in OpenCPN. In den OpenCPN
Einstellungen/Reiter "chart files" klickt man auf "Prepare all ENC
Charts".

![](../../img/ochartsng-convert-opencpn.png)

Das erzeugt eine Reihe von Dateien mit der Endung **.s57* im OpenCPN-Verzeichnis (unter Linux: ~/.opencpn/SENC). Aus diesem Verzeichnis kopiert man alle Dateien mit den gleichen Namen wie die S57-Dateien in ein neues, leeres Verzeichnis. Dieses sollte einen "sprechenden" Namen haben -
der wird später angezeigt. Anschließend erzeugt man eine Textdatei "Chartinfo.txt" in diesem Verzeichnis mit genau einer Zeile Text:

ChartInfo: -hier der name der Karte-

Dann erzeugt man ein Zip-Archiv, in dem das Kartenverzeichnis als
Unterverzeichnis enthalten ist. Dieses Archive kann man dann zu AvNav
O-ChartsNG hochladen.  
Für Linux gibt es ein [script](https://github.com/wellenvogel/ochartsng/blob/master/tools/collectS57.sh), um das Einsammeln der Karten zu automatisieren.