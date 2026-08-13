---
  tags:
    - Erweiterungen
    - Plugins
    - CSS
    - JavaScipt
---

# Erweiterungen und Plugins

AvNav bietet verschiedene Möglichkeiten die Funktionalität und das Aussehen zu erweitern und zu verändern.
Neben den Möglichkeiten zur [Einstellung](../base/settings.md) von Anzeige-Eigenschaften direkt in der Oberfläche, der Anpassung der Anzeigen (Widgets) über [Layouts](../base/layout.md) und der [Verbindungen](TODO: connections) und anderer [Parameter des Servers](configfile.md) gibt es dafür die folgenden Möglichkeiten:

1. Anpassung des Aussehens über [CSS](https://de.wikipedia.org/wiki/Cascading_Style_Sheets). AvNav ist eine Web-Anwendung und nutzt CSS für sein Aussehen. Eingebaut sind verschiedene Möglichkeiten, die dafür genutzten Regeln anzupassen:
    1. Eigenes CSS für alle Anzeigen in einer [user.css](usercss.md) Datei
    2. CSS für ein spezielles Layout - direkt im [Layout](TODO layout css)
    3. CSS in [Plugins](plugins.md)

2. Erweiterungen der Funktionalität der Anzeige über [JavaScript](https://de.wikipedia.org/wiki/JavaScript) code. Damit kann man z.B. einen neuen Formatierer hinzufügen, um einen Wert zur Anzeige in einem Widget umzuwandeln. 
Ausserdem kann man in weiteren Bereichen die Funktionalität erweitern (mit unterschiedlichen Schwierigkeitsgraden):
   * Erstellung eigener Daten-Anzeigen (oder Erweiterung bestehender Anzeigen) für die Navigationsseite und die Dashboards (textbasiert und grafisch)
   * Erstellung von Anzeigen direkt auf der Karte (Map Widgets)
   * Einbindung weiterer Kartentypen. Hier können z.B. verschiedene Typen von Vektor-Karten eingebunden werden.
   * Format-Funktionen für die Anzeige von Karten- oder Overlay-Informationen
   * Eigene Dialoge
   * Zugriff auf Online Resourcen
   * ...

   Dieser Code kann auf zwei Arten eingebracht werden:
    1. eine [user.mjs](userjs.md) Datei im Nutzerverzeichnis
    2. JavScript code in [Plugins](plugins.md#jscode)

3. Erweiterungen des Servers in [Python](https://de.wikipedia.org/wiki/Python_(Programmiersprache)).
   Diese Funktion ist nur für die Linux und Windows Version verfügbar. Der Python Code muss Bestandteil eines [Plugins](plugins.md#pluginpython) werden.

Alle diese Möglichkeiten erfordern ein gewisses KnowHow oder eine Einarbeitung in die jeweils genutzten Sprachen. Allerdings können einfache Anpassungen oft durch Diskussion in der [Community](TODO: community) oder durch KI Hilfe erreicht werden. Zum Erzeugen oder Bearbeiten der Erweiterungen wird nur ein guter Text-Editor benötigt, spezielle Tools sind nicht notwendig. Für viele Funktionen reicht bereits der in AvNav integrierte Editor aus.
!!! Hinweis
    Wenn man Erweiterungen erstellt, wird man meist Text in verschiedenen Dateien erzeugen oder bearbeiten. AvNav hat hierfür keine eingebauten Funktionen, um diese Daten (und auch eine Historie) noch einmal zu sichern. Daher sollten diese Daten (.zB. über die verfügbaren Download-Funktionen) noch einmal an einer anderen Stelle aufbewahrt werden. Das schützt vor Verlust, falls einmal das gesamte AvNav System ausfallen sollte.

## Dokumentation

Es gibt die folgenden detaillierten Dokumentationen zum Thema:

### CSS
* [user.css](usercss.md): Anpassungen des Aussehens mit nutzerspezifischem CSS code
* [CSS in Layouts](layout.md): CSS code direkt in Layouts
* [CSS in plugins](plugins.md#plugincss): CSS in Plugins

### JavaScript
* [user.mjs](userjs.md): Nutzereigener JavScript code für alle Displays
* [JavaScript in Plugins](plugins.md#jscode): JavaScript code in Plugins

### Plugins
* [Übersicht](plugins.md#overview)
* [Fertige Plugins](plugin-list.md): Liste bereits verfügbarer Plugins
* [CSS](plugins.md#plugincss): CSS in plugins
* [JavaScript](plugins.md#jscode): JavaScript code in Plugins
* [Server](plugins.md#pluginpython): Serverfunktionen für Plugins (mit Python)
