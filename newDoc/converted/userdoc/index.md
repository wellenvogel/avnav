AvNav Nutzerbeschreibung



AvNav WebApp Beschreibung
=========================

Die WebApp kann man im Normalfall über den Link http://avnav.avnav.de
oder http://avnav.local erreichen, wenn man sich im WLAN des Raspberry
befindet. Für einige detaillierte Hinweise zur Erreichbarkeit siehe die [Image Beschreibung](../install.md#connecting).

Unter [Android](../android/android.md) ist der Aufruf
direkt in der App integriert.  
Alternativ kann man auch auf seinem Mobilgerät einen Bonjour-Browser
installieren - dann findet man den avnav Server ganz ohne URL-Eingaben.  
Die passenden Apps dazu:

* IOS: [![](https://is4-ssl.mzstatic.com/image/thumb/Purple69/v4/ba/f9/c2/baf9c2dd-656d-c303-fae1-a07310825e72/pr_source.png/246x0w.png)](https://itunes.apple.com/us/app/bonjour-search-for-http-web-in-wi-fi/id1097517829?mt=8)
* Android: [![](https://lh3.googleusercontent.com/sOV0YDqS3VNhTd4PfLB4PKj89_bbP8MtFHCVydjSp1-zLMyc8LB_z_HFVsZQEFgINQ=s180-rw)](https://play.google.com/store/apps/details?id=de.wellenvogel.bonjourbrowser)

Die WebApp gliedert sich in eine Reihe von Seiten die man entweder direkt
von der Hauptseite - oder teilweise auch über bestimmte Zwischenseiten
erreicht.  
Normalerweise wird nach dem Aufruf zunächst die [Hauptseite](mainpage.md)
mit der Auswahl der Karten angezeigt. Ab 20240616 kann man mit [Einstellungen](settingspage.md)->Map->"start
with last map" erreichen, sodass nach dem Start sofort mit der zuletzt
genutzten Karte die [Navigationsseite](navpage.md) geöffnet
wird. Falls die Karte nicht sofort zur Verfügung steht (z.B. bei Plugin
Karten), kann es u.U. einige Zeit dauern, bis diese Karte angezeigt werden
kann. In diesem Falle wird auf das Erscheinen der Karte gewartet und ein
enstprechender Dialog angezeigt.

Über die Links in der 2. Spalte der Tabelle sind die Beschreibungen der
einzelnen Seiten erreichbar.

|  |  |  |  |
| --- | --- | --- | --- |
| Icon | Seite | Erreichbar | Funktion |
|  | [Hauptseite](mainpage.md) | Direkt nach dem Start | Anzeige der Liste der Karten, NMEA Status, Verzweigung zu weiteren Seiten |
|  | [Navigationsseite](navpage.md) | Klick auf eine Karte auf der Hauptseite | Basis-Navigationsfunktion, Karten und Instrumenten-Anzeige, Wegepunkte, Routen... |
|  | [Server/Status Seite](statuspage.md) | Button auf der Hauptseite | Status-Anzeige für den Server, Bearbeiten der Server Konfiguration, Weiterverzweigung zur [Wifi Konfiguration](wpapage.md), zur Anzeige der [Server-Adressen](addresspage.md), zum Herunterfahren und zur Lizenz-Info |
| {{BT("ShowSettings")}} | [Einstellungen](settingspage.md) | Button auf der Hauptseite | Einstellungen für die Anzeige im Browser, von dort weiter zum [Layout-Editor](../hints/layouts.md), zur [User Apps Konfiguration](addonconfigpage.md) und zu Android Settings (nur Android) |
| {{BT("DBDownload")}} | [Files/Download](downloadpage.md) | Button auf der Hauptseite | Anzeige, Download, Upload, Bearbeiten von Karten, Tracks, Routen, [Nutzerdateien](../hints/userjs.md), Bildern, [Layouts](../hints/layouts.md) |
|  | [Dashboard](dashboardpage.md) | Button auf der Hauptseite, Klick auf bestimmte Anzeigen auf der Navigationsseite | Anzeige von Instrumentendaten (bis zu 5 Unterseiten) |
| {{BT("ToRoute")}} | [Route Editor](editroutepage.md) | Button auf der [Navigationsseite](navpage.md#editroute) | Erstellen und Bearbeiten von Routen |
| {{BT("DBUserApp")}} | [User Apps](addonpage.md) | Button auf der Hauptseite (nur sichtbar wenn user apps konfiguriert) | Anzeige von internen oder externen HTML-Seiten (z.B. signalK Web Interface wenn konfiguriert) |
|  | [Wifi Konfiguration](wpapage.md) | Button auf der Statusseite () | Verbinden zu einem externen WLAN (nur wenn konfiguriert und WLAN Stick gesteckt ist, nicht Android) |
| {{BT("StatusAddresses")}} | [Anzeige der Serveradressen](addresspage.md) | Button auf der Statusseite () | Anzeige der aktuellen Serveradressen mit QR-Code zum einfachen Scannen mit einem anderen Gerät |
| {{BT("LayoutFinished")}} | [Layout Editor](../hints/layouts.md) | Button auf der Einstellungsseite ({{BT("ShowSettings")}}) | Bearbeiten der Anzeigen auf der Navigationsseite und auf den Dashboard Seiten |
| {{BT("DBUserApp")}} | [User App Konfiguration](addonconfigpage.md) | Button auf der Einstellungsseite ({{BT("ShowSettings")}}) | Definieren von externen oder internen HTML Seiten, die als User Apps angezeigt werden sollen |
|  | [Ais Info](navpage.md#aisinfo) | Klick auf die AIS Anzeige auf der [Navigationsseite](navpage.md) oder ein AIS Ziel auf der Karte | Anzeige der Informationen zu einem AIS Ziel. Von dort weiter zur [AIS Liste](aispage.md). |
|  | [Ais Liste](aispage.md) | Über die Ais Info Seite, Button | Anzeige der Liste der AIS Ziele in der Umgebung, sortierbar |
|  | [Import Seite](importerpage.md) | Über die Files/Download Seite, Button {{BT("ImportsView")}} | Karten Import (Konvertierung) - nicht unter Android |

  