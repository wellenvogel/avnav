Erweiterungen und Zusätze



Erweiterungen und Zusätze
=========================

Die Funktionalität von AvNav kann auf verschiedenen Wegen erweitert
werden. Einige solcher Erweiterungen werden bereits mit AvNav installiert,
andere als separate Pakete.

Einbindung anderer Webseiten
----------------------------

Man kann andere Webseiten (sowohl externe als auch solche, die auf HTML
Seiten innerhalb von AvNav basieren ) als sogenannte "User Apps"
einbetten.  
Es gibt eine dialog-basierende Konfiguration dafür auf der  [User
App Konfigurationsseite](../userdoc/addonconfigpage.md). Die Seiten sind dann auf der [User
App Seite](../userdoc/addonpage.md) sichtbar.

Erweiterung der Funktionen der Web App
--------------------------------------

Mit einigen Zeilen Java Script Code kann man Funktionalität zur Web App
hinzufügen. Insbesondere kann man eigene Anzeigen (Widgets) definieren -
sowohl textbasiert, als auch grafisch. Außerdem kann man Formatierer für
Anzeigewerte ergänzen - oder auch Buttons, die verschiedene Aktionen
anstoßen.  
Dieser Java Script Code wird in einer [user.js](userjs.md)
Datei gespeichert. AvNav enthält einen Editor für diese Datei auf der [Files/Download](../userdoc/downloadpage.md) Seite.  
Neben dem Java Script Code braucht man typischerweise auch CSS Code, um das
Aussehen anzupassen, dieser wird in einer [user.css](usercss.md)
Datei gespeichert.

Plugins
-------

== nicht unter Android ==

Plugins erlauben es, die Funktionalität von AvNav sowohl auf der
Server-Seite, als auch im Display (client) zu erweitern. Es gibt einige
Plugins, die AvNav bereits eingebaut mitbringt, andere können als separate
Pakete installiert werden. Darüber hinaus kann man eigene Plugins schreiben.

In AvNav eingebaute Plugins:

* Canboat  
  Dieses Plugin stellt einen Support für NMEA 2000 mit Canboat
  bereit. Siehe die [detaillierte
  Beschreibung](CanboatAndSignalk.md#Canboat).

Für die Entwicklung von eigenen Plugins und zum Sichten der Liste der Plugins, die man
als Pakete installieren kann, siehe die [Plugin
Beschreibung](plugins.md).  