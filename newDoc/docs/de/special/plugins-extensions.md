---
  tags:
    - Erweiterungen
    - Plugins
    - CSS
    - JavaScipt
---

# Erweiterungen und Plugins

AvNav bietet verschiedene Möglichkeiten die Funktionalität und das Aussehen zu erweitern und zu verändern.
Neben den Möglichkeiten zur [Einstellung](../base/settings.md) von Anzeige-Eigenschaften direkt in der Oberfläche, der Anpassung der Anzeigen (Widgets) über [Layouts](../base/layout.md) und der [Verbindungen](TODO: connections) und anderer [Parameter des Servers](TODO: server) gibt es dafür die folgenden Möglichkeiten:

1. Anpassung des Aussehens über [CSS](https://de.wikipedia.org/wiki/Cascading_Style_Sheets). AvNav ist eine Web-Anwendung und nutzt CSS für sein Aussehen. Eingebaut sind verschiedene Möglichkeiten, die dafür genutzten Regeln anzupassen:
    1. Eigenes CSS für alle Anzeigen in einer [user.css](TODOuser.css) Datei
    2. CSS für ein spezielles Layout - direkt im [Layout](TODO layout css)
    3. CSS in [Plugins](TODO: plugins)

2. Erweiterungen der Funktionalität der Anzeige über [JavaScript](https://de.wikipedia.org/wiki/JavaScript) code. Damit kann man z.B. einen neuen Formatierer hinzufügen, um einen Wert zur Anzeige in einem Widget umzuwandeln. Auch eigene Anzeigen und noch viele weitere Dinge kann man damit 
relativ einfach erstellen. Dieser Code kann auf zwei Arten eingebracht werden:
    1. eine [user.mjs](TODOuser.mjs) Datei im Nutzerverzeichnis
    2. JavScript code in [Plugins](TODO: plugins)

3. Erweiterungen des Servers in [Python](https://de.wikipedia.org/wiki/Python_(Programmiersprache)).
   Diese Funktion ist nur für die Linux und Windows Version verfügbar. Der Python Code muss Bestandteil eines [Plugins](TODO: plugins) werden.

Alle diese Möglichkeiten erfordern ein gewisses KnowHow oder eine Einarbeitung in die jeweils genutzten Sprachen. Allerdings können einfache Anpassungen oft durch Diskussion in der [Community](TODO: community) oder durch KI Hilfe erreicht werden.

## Dokumentation

Es gibt die folgenden detaillierten Dokumentationen zum Thema:

### CSS
* [user.css](usercss.md): Anpassungen des Aussehens mit nutzerspezifischem CSS code
* [CSS in Layouts](layout.md): CSS code direkt in Layouts
* [CSS in plugins](TODO: plugin-css): CSS in Plugins

### JavaScript
* [user.mjs](userjs.md): Nutzereigener JavScript code für alle Displays
* [JavaScript in Plugins](TODO: plugin-js): JavaScript code in Plugins

### Plugins
* [Übersicht](TODO: plugin-intro)
* [Fertige Plugins](TODO: plugin-list): Liste bereits verfügbarer Plugins
* [CSS](TODO: plugin-css): CSS in plugins
* [JavaScript](TODO: plugin-js): JavaScript code in Plugins
* [Server](TODO: plugins-server): Serverfunktionen für Plugins (mit Python)
