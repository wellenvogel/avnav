---
  tags:
    - Plugins
---

# Liste von AvNav Plugins

Plugins, die als Paket in der Liste aufgeführt sind, lassen sich nur unter Linux/RaspberryPi installieren. 
Zip Plugins können auf jeder Architektur installiert werden - in der Tabelle wird dazu ein Hinweis angegeben.

Die Spalte 'Repo' sagt aus, das das Paket in den [Paketquellen](../installation/linux.md#repositories) für die Installation vorhanden ist.

Die Spalte 'Image' gibt an, ob das Plugin standardmässig in den [AvNav Images](../installation/raspberry.md#images) installiert ist.

| Name | Typ | Repo | Image| Beschreibung |
| --- | --- | --- | --- | --- |
| [ochartsng](ochartsng.md)| Paket | ja | ja |Implementierung für Karten von  [o-charts](https://o-charts.org/) und freie S57 Karten |
| [Seatalk  Remote](https://github.com/wellenvogel/avnav-seatalk-remote-plugin)| Paket | ja | nein | in Zusammenspiel mit der Fernbedienung von [AK-Homberger](https://github.com/AK-Homberger/Seatalk-Autopilot-Remote-Control)|
| [History](https://github.com/wellenvogel/avnav-history-plugin)| Paket | ja | ja |Daten-Historie und Anzeige |
| [Update](https://github.com/wellenvogel/avnav-update-plugin) | Paket | ja | ja  | Update von AvNav (und den dazugehörigen Paketen) ohne die  Kommandozeile nutzen zu müssen. Konfig-Editor und Log-Viewer für AvNav |
| [MapProxy](https://github.com/wellenvogel/avnav-mapproxy-plugin)| Paket | ja | ja | integriert [MapProxy](https://mapproxy.org/) für Zugriff  und Download verschiedener online Kartenquellen |
| [Obp-RC-Remote](https://github.com/wellenvogel/avnav-obp-rc-remote-plugin) | Paket | ja | ja | plugin für die Nutzung der [Fernbedienung](https://www.segeln-forum.de/thread/78328-fernbedienung-f%C3%BCr-den-raspberry/?postID=2237852#post2237852)   von [Christian](https://www.segeln-forum.de/cms/user/19350-chrhartz/)|
| [Sail-Instrument-Plugin](https://github.com/kdschmidt1/Sail_Instrument)| Paket | TODO | TODO | Dekodierung und Berechnung von weiteren Kurs- und Winddaten,Sail Instrument |
| [Obp-PlotterV3](https://github.com/wellenvogel/avnav-obp-plotterv3-plugin)| Paket | ja | ja | Spezialfunktionen für den Open Boat Projects 10 Zoll Plotter (V3) |
| [Font Noto](https://github.com/wellenvogel/avnav-font-noto)| Zip | nein | nein | Noto Fonts für die Nutzung in AvNav |
| [Font Roboto](https://github.com/wellenvogel/avnav-font-roboto)| Zip | nein | nein | Roboto Fonts für die Nutzung in AvNav |
| [Logbuch](https://github.com/Surfer2010/avnav-logbuch-plugin/tree/main) | Zip | Nein | Nein | Ein Logbuch Plugin für AvNav (nur Windows/Linux/Raspberry) |
|[ocharts - legacy ](ocharts.md)| Paket | nein | nein | Karten von [o-charts](https://o-charts.org/) |
| [rudder-angle](https://gitlab.strukturpunkt.de/kfr/avnav-rudder-angel)| zip | nein | nein |Anzeige des Ruderwinkels (über SignalK, nur Linux/Raspberry) |