---
  tags:
    - Fernsteuerung
---
Fernsteuerung
=============

Ab Version 20210619 bietet AvNav die Möglichkeit, die Anzeige auf einem
Display-Gerät durch ein anderes Gerät oder vom Server aus fernzusteuern.

Das kann man beispielsweise nutzen, wenn man ein Gerät zur Anzeige in der
Plicht verwendet, dieses jedoch nicht in Griffweite ist. Dann kann man
z.B. mit einem am Körper befindlichen anderen Gerät - oder mit einer
Fernsteuerung - die Anzeige auf dem Display umschalten.

Ausserdem können die Linux- und Windows Versionen Fernsteuerkommandos per UDP empfangen, die dann auch an angeschlossene Displays weitergegeben werden können.
Auch [Plugins](TODO) können Fernsteuerkommandos senden.

Es existiert ein Plugin für die [OpenBoat Projects IR Fernbedienung](https://github.com/wellenvogel/avnav-obp-rc-remote-plugin) von [chrhartz](https://www.segeln-forum.de/cms/user/19350-chrhartz/).
Damit kann diese Fernbedienung ebenfalls zur Fernsteuerung genutzt werdn.


Funktionen
----------

Per Fernsteuerung können Seiten umgeschaltet werden und auf den Seiten
kann teilweise die Anzeige verändert werden (z.B. Auswahl der angezeigten
Dashboard Seite oder Auswahl der Karte).

In der Navigationsansicht wird das Verschieben der Karte, das Zentrieren
und das Zoomen übertragen.

Konfiguration
-------------

Insgesamt bietet AvNav 5 Fernsteuerungskanäle an. Für jedes Gerät kann
ausgewählt werden, welchen Kanal es nutzen soll und ob es auf diesem Kanal
Kommandos senden oder empfangen soll. Die Einstellungen erreicht man über

{{BT("MainNav")}} -> Remote Control.

Für ein schnelles Zu- und Abschalten erreicht man die Konfiguration auch über

{{BT("MainNav")}} -> Actions -> {{BT("RemoteChannel",True)}}.

Für eine funktionierende Fernsteuerung muss mindestens ein Display
Geräte auf einem Kanal auf Empfang eingestellt werden.
Wenn die Steuerung von einem anderen Display erfolgen soll, muss dieses auf dem gleichen Kanal auf Senden konfiguriert werden.

Man kann auch die Geräte so einstellen, das sie sowohl senden als auch
empfangen. Hier wird nach einer Wartezeit nach einer lokalen Bedieung
jeweils automatisch in den Empfangsmodus geschaltet.

Im Server muss der Handler für die Fernsteuerung aktiv sein
(standardmässig an).


Technik
-------

Intern verbindet sich jeder Browser mit dem konfigurierten
Fernsteuerungskanal auf dem Server (unter Nutzung von WebSockets). Auf
diesem Kanal sendet oder/und empfängt er dann Kommandos (je nach
Konfiguration).

Diese Kommandos sind entweder Tastendrücke oder etwas komplexere
Funktionen  z.B. zum Umschalten einer Seite.

Die Kommandos werden als String erwartet, über UDP mit einem
abschliessenden NewLine.  
Sie bestehen jeweils aus einem Typ und Parametern.

### Tasten-Kommandos

Ein Tasten-Kommando besteht aus einem "K", einem Leerzeichen und dem
Tastencode.

```
K Ctrl-  
K a
```

Die Tasten lösen die Aktion entsprechend ihrer Konfiguration aus ( siehe
[Tastatur-Steuerung](keyboard.md)).

### Komplexe Kommandos

Diese Kommandos lösen direkt bestimmte Aktionen in AvNav aus. Die
Parameter sind meist in JSON kodiert.  
Sie sind primär zur Steuerung von einem Display zu einem anderen gedacht
und ihre Form kann sich durchaus ändern.  
Prinzipiell sehen sie wie folgt aus:

```
CP navpage
```

In diesem Falle: setze die Seite "navpage". Eine Liste der Kommandos
findet sich im source code unter [remotechannel.ts](https://github.com/wellenvogel/avnav/blob/20bb02e6f5704b4cf5b461090051236cf867b78e/viewer/util/remotechannel.ts#L37).