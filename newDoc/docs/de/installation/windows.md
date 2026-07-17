---
  tags:
    - Windows
    - Installation
---

# Windows

Für Windows gibt es einen Installer (neu ab 20240520). Die aktuelle
Version zum Download findet man [hier](../../downloads/release/latest/avnav-service-latest.exe).
Dieser Installer erzeugt eine App "avnavservice" die (als default)
automatisch startet(User autostart). Dieser Service erzeugt eine
Notifikation (Icon), die bei Klick ein Menü mit den wichtigsten Funktionen
zeigt. Dieser Service enhält noch nicht die eigentliche AvNav-Software
(oder die notwendigen Python Pakete). Aber über das Menü können diese
installiert werden.  
Für eine Deinstallation von avnavservice bitte die Systemsteuerung nutzen.

![](../img/windows-notification-1.png)

![](../img/windows-notification-2.png)

Das Service-Menü hat die folgenden Einträge:

|  |  |
| --- | --- |
| Bezeichnung | Funktion |
| Start | Startet den AvNav Server. Nur aktiv, wenn die AvNav-Software installiert wurde und der Server noch nicht läuft. Der Service merkt sich, ob AvNav gestartet wurde, und wird es beim nächsten Start automatisch wieder starten, wenn nicht zwischenzeitlich "Stop" aktiviert wurde. |
| Stop | Stoppt den AvNav Server. |
| Open | Öffnet den default Browser mit der URL für den AvNav Server. |
| Logs | Öffnet ein Explorer-Fenster im AvNav log-Verzeichnis (PROFILEDIR/AvNav/logs). Dort gibt es das normale avnav.log und zusätzlich die Ausgabe vom Startup(service-err.log).  Um z.B. zur AvNav XML-Konfiguration zu gelangen, muss man nur im Explorer ein Verzeichnis nach oben navigieren. |
| Config | Erlaubt es, den HTTP Port für AvNav zu setzen(default: 8080). |
| Update | Dieser Eintrag ist "Install", wenn die AvNav-Software noch nicht installiert wurde.  Ein Installationsdialog wird geöffnet(siehe [unten](#windowsinstall)). |
| Remove | Entfernt die installierte AvNav-Software (aber alle Nutzerdaten unter PROFILEDIR/AvNav bleiben erhalten).  Vor einer Deinstallation von avnavservice (über Systemsteuerung/Software) sollte das genutzt werden - sonst muss man später das Verzeichnis PROFILEDIR/AppData/Local/avnav per Hand entfernen. |
| Exit | Stoppt AvNav und beendet avnavservice (die Notifikation verschwindet). Um den Service erneut zu starten, nutzt man das Startmenü.  Normalerweise kann man den Service laufen lassen. Wenn der AvNav Server gestoppt ist, werden kaum Systemresourcen verbraucht. Nur nach einer erneuten Installtion von avnavservice muss man diesen einmal stoppen und wieder starten. |

### Installation {: #windowsinstall}

Nach Klick auf Install/Update wird ein kleiner Dialog angezeigt.

![](../img/windows-install-1.png)

Die hier eingetragene URL zeigt auf die aktuelle AvNav-Software. Aber man
kann hier jede URL eingeben, die auf ein aktuelles AvNav-Softwarepaket zeigt
(zip Datei) - z.B. von den [daily](../downloads/daily) oder [release](../downloads/release) Seiten.   

Nach OK wird ein Fenster mit dem Installationsfortschritt angezeigt.

![](../img/windows-install-2.png)

Nachdem man diese Fenster geschlossen hat, kann man den AvNav Server über
"Start" im Menü wieder starten.  

### Windows Hinweise

Der avnavservice erfordert Powershell (>= 5.x) - das sollte auf allen
modernen Windows Systemen verfügbar sein. Wenn die AvNav-Installation in
einen Fehler läuft, kann es sein, dass die neuesten C/C++ Bibliotheken
nicht installiert sind. Diese kann man von [Microsoft](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170)
herunter laden. Der direkte Link ist normalerweise [hier](https://aka.ms/vs/17/release/vc_redist.x64.exe).

Dieser neue Windows-Service ersetzt die alte AvNavNet-Installation mit
einer eigenen GUI. Releases ab 20240520 sind nicht mehr kompatibel mit der
alten Version. Es wird empfohlen, die alte Installation komplett zu
entfernen, ehe der neue Installer genutzt wird.

Die Karten-Konvertierung ist nun ohnehin komplett in AvNav integriert und
kann so genutzt werden wie in der App-Dokumentation beschrieben.  
Man kann serielle Geräte, die am Windows System angeschlossen sind, ganz
normal benutzen(z.B. einen GPS Stick).

Da der AvNav Server im Hintergrund läuft, kann man ihn zum Beispiel auch
als NMEA-Multiplexer und Logger nutzen.