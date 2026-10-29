---
  tags:
    - Plugins
---

# Liste von AvNav Plugins

Plugins, die als **Paket** in der Liste aufgeführt sind, lassen sich nur unter Linux/RaspberryPi, aber nicht unter Android installieren. 
**Zip Plugins** können auf jeder Architektur installiert werden - in der Tabelle wird dazu ein Hinweis angegeben.

Die Spalte 'Repo' sagt aus, dass das Paket in den [Paketquellen](../installation/linux.md#repositories) für die Installation vorhanden ist.

Die Spalte 'Image' gibt an, ob das Plugin standardmäßig in den [AvNav Images](../installation/raspberry.md#images) installiert ist.

| Name | Typ | Repo | Image| Beschreibung |
| --- | --- | --- | --- | --- |
| [ochartsng](ochartsng.md)| Paket | ja | ja |Implementierung für Karten von  [O-Charts](https://o-charts.org/) und freie S57-Karten. **Besonderheit:** Für Android ist das Plugin als separate App ["AvOcharts"](https://play.google.com/store/apps/details?id=de.wellenvogel.ochartsprovider) verfügbar. |
| [Seatalk  Remote](https://github.com/wellenvogel/avnav-seatalk-remote-plugin)| Paket | ja | nein | in Zusammenspiel mit der Fernbedienung von [AK-Homberger](https://github.com/AK-Homberger/Seatalk-Autopilot-Remote-Control)|
| [History](https://github.com/wellenvogel/avnav-history-plugin)| Paket | ja | ja |Daten-Historie und Anzeige |
| [Update](https://github.com/wellenvogel/avnav-update-plugin) | Paket | ja | ja  | Update von AvNav und der dazugehörigen Pakete, ohne die  Kommandozeile nutzen zu müssen. Konfig-Editor und Log-Viewer für AvNav |
| [MapProxy](https://github.com/wellenvogel/avnav-mapproxy-plugin)| Paket | ja | ja | integriert [MapProxy](https://mapproxy.org/) für Zugriff  und Download verschiedener Online-Kartenquellen |
| [Obp-RC-Remote](https://github.com/wellenvogel/avnav-obp-rc-remote-plugin) | Paket | ja | ja | Plugin für die Nutzung der [Fernbedienung](https://www.segeln-forum.de/thread/78328-fernbedienung-f%C3%BCr-den-raspberry/?postID=2237852#post2237852)   von [Christian Hartz](https://www.segeln-forum.de/cms/user/19350-chrhartz/)|
| [Sail-Instrument-Plugin](https://github.com/kdschmidt1/Sail_Instrument)| Paket | ja | nein | Dekodierung und Berechnung von weiteren Kurs- und Winddaten, Sail Instrument |
| [Obp-PlotterV3](https://github.com/wellenvogel/avnav-obp-plotterv3-plugin)| Paket | ja | ja | Spezialfunktionen für den Open Boat Projects 10 Zoll Plotter V3 |
| [Font Noto](https://github.com/wellenvogel/avnav-font-noto)| Zip | nein | nein | Noto Fonts für die Nutzung in AvNav |
| [Font Roboto](https://github.com/wellenvogel/avnav-font-roboto)| Zip | nein | nein | Roboto Fonts für die Nutzung in AvNav |
| [Logbuch](https://github.com/Surfer2010/avnav-logbuch-plugin/tree/main) | Zip | Nein | Nein | Ein Logbuch-Plugin für AvNav (nur Windows/Linux/Raspberry) |
| [Legacy Display](https://github.com/Surfer2010/avnav-legacy-display)| Zip | nein | nein | Anzeige auf alten Browsern z.B. von E-Book-Readern, auf denen AvNav sonst nicht läuft. _Nur unter Windows/Linux/Raspberry_ |
| [Legacy Display II](https://github.com/wellenvogel/avnav-simpledashplugin) | Zip | nein | nein | Andere Variante für ein Display auf alten Browsern wie E-Book-Readern. Anpassung der Displays durch den Nutzer über das Editieren von HTML-Seiten - oder mit KI. _Alle Plattformen, auch Android_ |
|[ocharts - legacy ]({{OLDLINK("hints/ocharts.html")}})| Paket | nein | nein | Karten von [O-Charts](https://o-charts.org/) |
| [rudder-angle](https://gitlab.strukturpunkt.de/kfr/avnav-rudder-angel)| zip | nein | nein |Anzeige des Ruderwinkels (über SignalK, _nur Linux/Raspberry_) |
| [AvNav Dokumentation]({{DLLINK("release")}}) {: #docplugin}| zip | nein | nein | Diese AvNav-Dokumentation als Plugin. Bitte jeweils das aktuelle "documentation-xxxx.zip" installieren.|
| [AvNav Dokumentation Videos]({{DLLINK("supplement/docvideos.zip")}})| zip | nein | nein | Die Videos zur AvNav-Dokumentation. Damit sind die Videos auch offline verfügbar, wenn die Dokumentation über dieses Plugin geöffnet wird.|

## Dokumentation als Plugin {: #documentation}

Diese Dokumentation kann in AvNav als [Plugin](#docplugin) installiert werden. Mit jeder [Release](../installation/release.md) wird eine Datei documentation-xxx.zip ausgeliefert. Zur Installation diese Datei aus dem entsprechenden [Release Verzeichnis]({{DLLINK("release")}}) herunterladen und auf der Plugin-Seite

{{MM("MMpluginspage")}}

über den {{BT("Upload")}} Button zu AvNav hochladen. Die Dokumentation erzeugt auf der User-App-Seite

{{MM("MMaddonpage")}}

einen Button ![Manual](../../img/manual.svg){.inline-image}. Mit diesem Button kann die Dokumentation geöffnet werden.

Die Videos sind nicht direkt im Plugin eingebettet, sondern werden als externe Links bei YouTube aufgerufen.

Wenn man die Videos auch offline verfügbar haben möchte, kann man zusätzlich das AvNav-Dokumentation-Videos plugin installieren. Es kann von einem [festen Link]({{DLLINK("supplement/docvideos.zip")}}) heruntergeladen werden, da es sich nur sehr selten ändert.

Nach der Installation dieses Videos gibt es einen weiteren Button ![Video Dokumentation](../../img/video-help.svg){.inline-image} - wenn man die Dokumentation über diesen Button aufruft, sind die Videos eingebettet und können auch offline genutzt werden.


