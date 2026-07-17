AvNav Config File



AvNav Server Konfiguration
==========================

== nicht für [Android](../android/android.md#Settings) ==

Einführung
----------

Der AvNav server liest beim Start seine Konfiguration aus einer xml Datei
- avnav\_server.xml.  
Diese Datei befindet sich normalerweise unter /home/pi/avnav/data auf dem
Raspberry, sonst unter $HOME/avnav - siehe [Installation](../install.md).

Wenn diese Datei beim ersten Start noch nicht existiert, wird sie aus
einem Template erzeugt - passend für den [Raspberry](https://github.com/wellenvogel/avnav/blob/master/raspberry/avnav_server.xml)
oder [andere
Systeme](https://github.com/wellenvogel/avnav/blob/master/linux/avnav_template.xml).  
Dieses Template ist auf dem Raspberry Pi (mit dem Paket avnav-raspi) 
die Datei /etc/avnav\_server.xml (ab 20230426). Wenn diese nicht existiert,
wird eine Datei aus dem Paket als Template genutzt.  
Falls AvNav von der Kommandozeile über das Kommando "avnav" gestartet
wird, kann mit der Option -t ein Template angegeben werden.

Bei Updates der AvNav Software wird diese Datei im Allgemeinen nicht
geändert. Es kann aber sein, dass für neue Funktionen neue Einträge nötig
werden. Dann wird in den [Release Notes](../release.md)
darauf hingewiesen.

Mit jedem erfolgreichen Start (ab Version 20200325) schreibt AvNav eine
Kopie diese Datei mit der Endung .ok. Falls beim nächsten Start das Parsen
der xml Datei fehlschlägt, liest er stattdessen die .ok Datei. Diese
Funktion soll verhindern, dass nach einer Änderung, die AvNav in manchen
Situation selbst vornimmt, der nächste Start ggf. scheitert.

Wenn AvNav nicht mehr starten kann wegen Fehler in der Konfiguration,
kann man die avnav\_server.xml komplett entfernen und danach noch einmal
starten. AvNav startet dann wieder von einem "sauberen" Template.

Beginnend ab Version 20210322 **es ist nicht mehr nötig, die Datei "per
Hand" zu bearbeiten**. Stattdessen sollte AvNav selbst ([Server/Status
Seite](../userdoc/statuspage.md)) für die Bearbeitung der meisten Parameter genutzt werden. Das
vermeidet auch die Notwendigkeit eines Restarts nach Änderungen.  
In den folgenden Beschreibungen wird in der Spalte "online" angezeigt, ob
die Parameter direkt auf der Server/Status Seite geändert werden können.

Wenn Parameter geändert werden müssen, die nicht direkt bearbeitbar sind,
sollte das [avnav-update-plugin](https://github.com/wellenvogel/avnav-update-plugin)
genutzt werden, um die Datei direkt im Browser zu bearbeiten.  
Die Hinweise hier darunter sind also nur noch eine Zusatzinformation.

Wenn man Änderungen an der Konfiguration vornimmt, muss AvNav danach neu
gestartet werden (das gilt aber nicht für Änderungen, die direkt auf der
Server/Status Seite vorgenommen wurden). Wenn AvNav als Systemdienst
läuft, macht man das mit dem Kommando

```
sudo systemctl restart avnav
```

Es empfiehlt sich jedoch, nach einer Änderung AvNav zunächst einmal nur
von der Kommandozeile zu starten, um zu sehen, ob es schwerwiegende Fehler
gibt. Die Kommandofolge ist dann

```
sudo systemctl stop avnav  
avnav -e  
^C  
sudo systemctl start avnav
```

Die option -e gilt erst ab Version 20200325. Sie verhindert, dass im
Fehlerfall die avnav\_server.xml.ok geladen wird. ^C bricht das laufende
AvNav wieder ab.

Inhalt
------

Innerhalb der avnav\_server.xml sind Einträge für die einzelnen
Bestandteile von AvNav enthalten. In den Templates sind bereits viele
kommentierte Beispiele für entsprechende Einstellungen.

Grundsätzlich gibt es 3 Kategorien von solchen Bestandteilen:

1. Anteile, die nur genau einmal auftreten dürfen, die aber unbedingt in
   der avnav\_server.xml stehen müssen  
   Beispiele: AVNConfig, AVNHttpServer,...
2. Anteile, die im Normalfall nicht in der avnav\_config.xml stehen
   müssen, nur wenn etwas Spezielles konfiguriert werden soll  
   Beispiele: AVNAlarmHandler, AVNChartHandler,...
3. Anteile, die ein- oder mehrfach in der avnav\_server.xml stehen können.
   Das sind insbesondere die Eingangs- und Ausgangskanäle. Wenn kein
   solcher Eintrag vorhanden ist, steht die Funktion nicht zur Verfügung.

Es gibt einige Eigenschaften, die an mehreren Bestandteilen auftauchen,
für diese hier eine Erklärung.

|  |  |  |
| --- | --- | --- |
| Name | Beschreibung | Beispiel |
| enabled | Viele Handler können auf der Server/Status Seite mit diesem Parameter ein- bzw. ausgeschaltet werdem | ein |
| name | Name eines Input oder Output Kanals. Dieser wird auf der Status-Seite angezeigt und kann auch im Parameter [blackList](#blackList) für Filterungen genutzt werden | nmea0183tosignalk |
| filter | Filterung von NMEA Daten. hier können durch Komma getrennte Filter angegeben werden, die bestimmen, welche NMEA Daten durchgelassen werden. Um sie unabhängig von Talker Ids zu machen, werden die 2 Zeichen nach einem $ nicht berücksichtigt. Ein Filter für $GPRMC sieht dann so aus: $RMC.  Wenn dem Filter ein ^ vorangestellt wird, wird er negiert, also ^$RMC heisst: keine RMC records. AIS Daten kann man mit dem Filter "!" oder "!AIVDM" matchen.  Mehrere Enträge müssen durch , getrennt werden. | $RMC,^$RMB,!AIVDM |
| readFilter | Für kombinierte Reader/Writer ein Filter für die Eingangsseite. Siehe [filter](#filter) |  |
| blackList | Liste von Kanal-Namen, deren Daten nicht ausgesendet werden sollen. Schreibweise beachten (grosses L) | nmea0183tosignalk |
| priority  (since 20220421) | Alle NMEA Input Kanäle haben ein priority Feld. Dieses beeinflusst, welcher Wert gewinnt, wenn die gleichen Werte von mehreren Kanälen dekodiert werden. Die default priority ist 50, sie kann nach oben und unten geändert werden. Die SignalK Integration hat die default Priority 40. | 50 |

Im Folgenden sind die wichtigsten Bestandteile mit ihren Parametern
aufgeführt. Falls Parameter hier nicht beschrieben sind, aber ggf. in
einem Template auftauchen, sollte sie so belassen werden, wie sie dort
sind.

### AVNConfig

Basis Konfiguration und Systemzeit, Kategorie 1 (1x,nötig)

|  |  |  |  |
| --- | --- | --- | --- |
| Name | Online | Beschreibung | default/template |
| settimecmd |  | Ein Kommando, das aufgerufen wird, um die Systemzeit zu setzen. Der Parameter ist ein Zeitstempel in UTC so wie er für date -u benötigt wird. | nur gesetzt mit dem avnav-raspi Paket |
| settime  (ab 203304xx) | X | Wen ein, setze die Systemzeit (settimecmd muss ebenfalls gesetzt sein) | ein |
| maxtimeback | X | maximale Zeit, die die Systemzeit rückwärts gesetzt wird, bevor alle internen Daten gelöscht werden (s) | 5 |
| systimediff | X | maximale Zeitabweichung der Systemzeit von der gps-Zeit bevor die Systemzeit neu gesetzt wird (s) | 5 |
| settimeperiod | X | Zeit in s bevor die Systemzeit erneut gesetzt wird | 3600 |
| ntphost  (ab 20220421) | X | Ein ntp server. Dieser wird befragt, wenn keine gültige GPS Zeit vorhanden ist und settime aktiv ist | pool.ntp.org |
| switchtime  (ab 20220421) | X | Zeit(in s) die nach dem Setzen der Zeit mindestens gewartet wird, bevor von gps zu ntp oder zurück gewechselt wird. Diese Zeit wird auch nach dem Start auf eine gültige GPS Zeit gewartet wird | 60 |
| ownMMSI | X | MMSI des eigenen Bootes, diese wird aus den AIS Daten ausgefiltert |  |
| expiryTime | X | Zeit (in s) die empfangene NMEA Daten gültig bleiben | 30 |
| aisExpiryTime | X | Zeit (in s) die empfangene AIS Daten gültig bleiben | 1200 |

### AVNQueue

Die interne NMEA Warteschlange . category 2 (einmal, optional).

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Description | default/template |
| maxList | X | max number of NMEA records in the queue | 300 |
| naxAge | X | max age in seconds an entry is kept in the queue. Older entries are discarded.  This prevents slow outputs to send out data that is already very old. | 3 |

### AVNHttpServer

Der interne HTTP server. Kategorie 1 (einmal, erforderlich).

Neben den Parametern für AVNHttpServer gibt es einige Unter-Einträge, die
sich mehrfach wiederholen können. Im Normalfall sollten hier aber keine
Änderungen nötig sein (Directory,MimeType).

Ausser dem httpPort sollten normalerweise keine Änderungen erforderlich
sein.

#### Parameter für AVNHttpServer

|  |  |  |
| --- | --- | --- |
| Name | Beschreibung | default/template |
| httpPort | der Port, auf dem der HTTP Server Anfragen annimmt | 8080 |
| navurl | REST interface, nicht änderbar | /viewer/avnav\_navi.php |
| index | Startseite, nicht änderbar | /viewer/avnav\_viewer.html |
| httpHost | Die Bind Adresse, man kann hier z.B. auf ein bestimmtes Netzwerk beschränken | 0.0.0.0 |
| numThreads | Die Zahl der vom Server genutzten Threads | 5 |

#### Parameter für Directory

Diese Werte werden meist durch den Aufruf (Parameter -u bei avnav)
überschrieben und sollten nicht geändert werden.

|  |  |  |
| --- | --- | --- |
| Name | Beschreibung | default/template |
| urlpath | die URL (ohne /) |  |
| path | der reale Pfad auf dem System |  |

#### Parameter für MimeType

Hier werden mime types für Dateinamensendungen konfiguriert. Falls eine
eigene Anwendung hier ggf. etwas spezielles benötigt, kann man das
ergänzen.

|  |  |  |
| --- | --- | --- |
| Name | Beschreibung | default/template |
| extension | Namens-Endung (z.B. .avt) |  |
| type | Mime type (z.B. text/plain) |  |

### AVNBlueToothReader

Lesen von Bluetooth Geräten mit seriellem Profil. Kategorie 3 (einmal
möglich, optional)  
Nur möglich, wenn das Gerät ein Bluetooth Device hat.

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| maxDevices | X | Anzahl der maximal gleichzeitig verbundenen Bluetooth Geräte | 5 |
| deviceList | X | Komma-separierte Liste von Bluetooth Geräte-Ids. Wenn gesetzt, werden nur diese Geräte verbunden. |  |
| filter | X | [filter](#filter) für NMEA Daten |  |
| name | X |  |  |
| enabled | X |  |  |
| priority | X |  |  |

### AVNSerialReader {: #AVNSerialReader}

Lesen von seriellen Geräten. Kategorie 3 (mehrfach, optional). Dieser
Reader sollte nur für direkt per Hardware (UART) verbundene Geräte genutzt
werden, für Geräte, die per USB angeschlossen sind ist der [AVNUsbSerialReader](#AVNUsbSerialReader)
zuständig.

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| name | X | Kanal Name für die Nutzung in blackList und für die Anzeige | intern gebildeter Name |
| port | X | Gerätename, z.B. /dev/ttyAMA0 |  |
| baud | X | Baudrate. Wenn minBaud auch angegeben ist, die maximale Baudrate, die für das automatische Feststellen der Baudrate genutzt wird | 4800 |
| minbaud | X | Minimale Baudrate, die für eine automatische Erkenung genutzt wird. Wenn nicht gesetzt oder 0 - automatische Erkennung aus |  |
| timeout | X | Timeout in s, nach dem das Gerät ohne Daten geschlossen und wieder geöffnet wird | 2 |
| bytesize | X | serielle Byte Größe | 8 |
| parity | X | Parity | N |
| stopbits | X | Anzahl der Stopbits | 1 |
| xonxoff | X | Nutzung xon/xoff Protokoll (0: aus) | 0 |
| rtscts | X | RTS/CTS Nutzung (0: aus) | 0 |
| numerrors | X | Anzahl der Fehler, nach der das Gerät geschlossen und neu geöffnet wird. | 20 |
| autobaudtime | X | Zeit in s, die versucht wird, ein Newline in den Daten zu erkennen (während der automatischen Baudraten-Erkennung) | 5 |
| filter | X | NMEA Filter, siehe [filter](#filter) |  |
| enabled | X |  |  |
| priority | X |  |  |

### AVNSerialWriter {: #AVNSerialWriter}

Ausgang über ein serielles Gerät. Auch kombiniert Ein- und Ausgang.
Kategorie 3 (optional)  
Nur für direkte serielle Geräte, nicht für USB-Wandler ([AVNUsbSerialReader](#AVNUsbSerialReader)
für diese)

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| name | X | channel name |  |
| combined | X | wenn "true", dann gleichzeitig Eingang und Ausgang | false |
| readFilter | X | [filter](#filter) für die Eingangsrichtung. Der Parameter "filter" bezieht sich auf die Ausgangsrichtung! |  |
| blackList | X | [blackList](#blackList), Komma getrennte Liste von Kanalnamen, deren Daten nicht ausgegeben werden sollen. |  |
| .... |  | alle Parameter von [AVNSerialReader](#AVNSerialReader) |  |

### AVNUsbSerialReader

Behandelt über USB angeschlossene serielle Geräte. Kategorie 3(einmal,
optional).  
Dieser Worker sucht alle über USB verbundenen Geräte. Solche mit einem
seriellen Profil versucht er zu öffnen, automatische die Baudrate
einzustellen und dann NMEA Daten zu lesen. Damit werden solche Geräte
normalerweise komplett automatisch von AvNav erkannt.  
Man kann für einzelne Geräte Regeln definieren, um sie speziell zu
behandeln. Als Identifikation für ein Gerät wird dabei eine ID genutzt,
die die enstprechende USB Buchse identifiziert. Mann kann diese ID am
einfachsten ermitteln, indem man bei Einstecken des Gerätes die [Status
Seite](../userdoc/statuspage.md) beobachtet.

Die Parameter gliedern sich in 2 Teile:

* Attribute für den Eintrag selbst
* Darunter liegende Einträge des Types UsbDevice

Beispiel

```
<AVNUsbSerialReader maxDevices="5" allowUnknown="true" baud="38400" minbaud="4800">
<UsbDevice usbid="1-1.2.1:1.0" baud="38400" minbaud="4800" filter="$RMC"/>  
</AVNUsbSerialReader>
```

#### Parameter für AVNUsbSerialReader

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| maxDevices | X | maximale Zahl von gleichzeitig verbundenen USB Geräten | 5 |
| allowUnknown | X | nur wenn dieser Eintrag auf "true" steht, werden Geräte eingebunden, die nicht explizit mit UsbDevice konfiguriert sind | true |
| ... | X | alle Parameter von [AVNSerialReader](#AVNSerialReader) bis auf port. Diese werden für nicht explizit konfigurierte Geräte gesetzt. |  |

#### Parameter für UsbDevice

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| usbid | X | USB Port identifikation z.B. "1-1.2.1:1.0", erforderlich |  |
| type | X | Type des Gerätes reader, writer, combined, ignore, setze ignore, wenn das Gerät nicht genutzt werden soll | reader |
| ... |  | alle Parameter von [AVNSerialReader](#AVNSerialReader) wenn der type = "reader" ist (bis auf port, dieser wird intern gesetzt) |  |
| ... |  | alle Parameter von [AVNSerialWriter](#AVNSerialWriter)wenn der type combined oder writer ist (bis auf port, dieser wird intern gesetzt) |  |

### AVNUdpReader

Öffnet einen UPD port und verarbeitet dort hereinkommende Daten.
Kategorie 3(optional, mehrfach).

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| name | X | Kanalname für die Nutzung in [blackList](#blackList) und in der Anzeige | intern berechnet |
| port | X | UDP port |  |
| host | X | Bind Adresse für den Port. Damit kann der Empfang z.B. auf localhost begrenzt werden. | 0.0.0.0 |
| minTime | X | wenn gesetzt: Wartezeit in s bevor ein weiterer Datensatz empfangen wird. Hiermit kann u.U. die Datenrate begrenzt werden. | 0 |
| filter | X | [filter](#filter) für NMEA Daten |  |
| enabled | X |  |  |
| priority | X |  |  |
| stripLeading | X | Entferne alle Zeichen vor $ oder ! in einer Zeile. | aus |
| joinMulticast | X | Tritt einer [Multicast](https://de.wikipedia.org/wiki/Multicast) Gruppe bei, das ermöglich den Empfang von Multicast Nachrichten. | aus |
| multicastAddr | X | Multicast Adresse. Damit wird der Empfang von Multicast Nachrichten auf dieser Adresse ermöglicht. | 224.0.0.1 |

### AVNUdpWriter

Sendet NMEA Daten per UDP. Kategorie 3 (optional, mehrfach)

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| name | X | Kanalname | intern berechnet |
| port | X | UDP Ziel port | 2000 |
| host | X | UDP Zieladresse | localhost |
| filter | X | [filter](#filter) NMEA Daten, die gesendet werden |  |
| broadcast | X | muss auf true gesetzt werden, wenn die Daten als broadcast geschickt werden sollen | false |
| blackList | X | [blackList](#blackList) für Kanalnamen, deren Daten nicht gesendet werden sollen |  |
| enabled | X |  |  |

### AVNSocketWriter

Ein Ausgang, der auf einem Port auf Verbindungen wartet und an diese die
NMEA Daten ausgibt (TCP server). Kategorie 3 (mehrfach, optional).

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| name | X | Kanalname | intern berechnet |
| port | X | der Listener Port |  |
| address | X | wenn gesetzt, binde auf diese Adresse (sonst any: 0.0.0.0) |  |
| filter | X | [filter](#filter) für NMEA Daten |  |
| read | X | wenn true, werden auch Daten vom Socket gelesen | false |
| priority | X | nur wenn read aktiv ist |  |
| readFilter | X | falls auch gelesen wird, NMEA [filter](#filter) für die Eingangsrichtung |  |
| blackList | X | [blackList](#blackList) durch Komma getrennte Liste von Kanalnamen, für die keine Daten ausgegeben werden |  |
| minTime | X | minimale Zeit in s zwischen 2 gesendeten Nachrichten. Damit kann die Datenrate begrenzt werden. | 0 |
| avahiEnabled | X | wenn eingeschaltet, wird der Service über avahi als \_nmea-0183.\_tcp bekannt gemacht | aus |
| avahiName | X | der Name für den avahi service | avnav-server |
| enabled | X |  |  |
| sendOwn | X | sende empfangene Daten auf der gleichen Verbindung | aus |

### AVNSocketReader

Ein Eingang, der sich mit einem TCP Server verbindet und von dort Daten
liest (TCP client). Kategorie 3 (mehrfach, optional)

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| name | X | Kanalname | intern berechnet |
| port | X | TCP Port zu dem eine Verbindung aufgebaut wird |  |
| host | X | TCP Zieladresse zu der eine Verbindung aufgebaut wird |  |
| timeout | X | Verbindungs-timeout in s | 10 |
| minTime | X | Minimale Zeit zwischen 2 empfangenen Nachrichten | 0 |
| filter | X | [filter](#filter) für NMEA Daten | leer |
| writeOut | X | sende NMEA Daten auf dieser Verbindung | aus |
| writeFilter | X | [Filter](#filter) für gesendete NMEA Daten | leer |
| blackList | X | , separierte Liste von Source-Namen, deren Daten nicht gesendet werden | leer |
| enabled | X |  |  |
| priority | X |  |  |
| stripLeading | X | Entferne alle Zeichen vor $ oder ! in einer Zeile. | aus |
| sendOwn | X | sende empfangene Daten auf der gleichen Verbindung | aus |

### AVNNmea0183ServiceReader

Dieser handler ist dem AVNSocketReader sehr ähnlich. Aber anstelle der
Konfiguration von host und port wird hier der Name des Services
konfiguriert. AvNav sucht im Netz nach (MDNS/Bonjour/Avahi) Services vom
Typ\_nmea-0183.\_tcp . Wenn der Eintrag über die Web Oberfläche erfolgt,
bietet AvNav die Liste der gefundenen Services zur Auswahl an. MIt diesem
Handler kann eine Verbindung auch dann wieder aufgebaut werden, wenn sich
z.B. die IP Adressen ändern.

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Description | default/template |
| serviceName | X | Der Name des Services (AvNav bietet eine Liste) | -- |
| timeout | X | Verbindungstimeout in Sekunden | 10 |
| minTime | X | minimale Zeit zwischen 2 empfangenen Nachrichten. | 0 |
| filter | X | [Filter](#filter) für NMEA Daten | leer |
| writeOut | X | sende NMEA Daten auf dieser Verbindung | aus |
| writeFilter | X | [Filter](#filter) für gesendete NMEA Daten | leer |
| blackList | X | , separierte Liste von Source-Namen, deren Daten nicht gesendet werden | leer |
| sendOwn | X | sende empfangene Daten auf der gleichen Verbindung | aus |
| name | X |  |  |
| priority | X |  |  |
| enabled | X |  |  |

### AVNBME280Reader

Reader für BME280 per I2C. Kategorie 3 (optional)  
Schreibt MDA und XDR Datensätze.  
Nur sichtbar, wenn python3-smbus installiert ist.

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| name | X | Kanalname | intern berechnet |
| addr | X | I2C Adresse des Sensors | 0x77 |
| interval | X | Zeit zwischen 2 NMEA Datensätzen in s | 5 |
| writeXdr | X | Schreibe XDR wenn true | true |
| writeMda | X | Schreibe MDA wenn true | true |
| namePress | X | XDR Transducer Name für Luftdruck | Barometer |
| offsetPress | X | addiere diesen Wert (in hPa) zum gemessenen Druck | 0 |
| nameHumid | X | XDR Transducer Name für Feuchtigkeit | Humidity |
| nameTemp | X | XDR transducer Name für Temperatur | TempAir |
| enabled | X |  |  |
| priority | X |  |  |

### AVNBMB180Reader

Reader für BMP180 per I2C. Kategorie 3 (optional)  
Schreibt MDA und XDR Datensätze.

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| name | X | Kanalname | intern berechnet |
| addr | X | I2C Adresse des Sensors | 0x77 |
| interval | X | Zeit zwischen 2 NMEA Datensätzen in s | 5 |
| writeXdr | X | Schreibe XDR wenn true | true |
| writeMda | X | Schreibe MDA wenn true | true |
| namePress | X | XDR Transducer Name für Luftdruck | Barometer |
| offsetPress | X | addiere diesen Wert (in hPa) zum gemessenen Druck | 0 |
| nameTemp | X | XDR transducer Name für Temperatur | TempAir |
| enabled | X |  |  |
| priority | X |  |  |

### AVNSenseHatReader

Reader für SenseHat I2C. Kategorie 3 (optional)  
Schreibt MDA und XDR Datensätze.  
Erfordert python3-sense-hat

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| name | X | Kanalname | intern berechnet |
| interval | X | Zeit zwischen 2 NMEA Datensätzen in s | 5 |
| writeXdr | X | Schreibe XDR wenn true | true |
| writeMda | X | Schreibe MDA wenn true | true |
| namePress | X | XDR Transducer Name für Luftdruck | Barometer |
| offsetPress | X | addiere diesen Wert (in hPa) zum gemessenen Druck | 0 |
| nameHumid | X | XDR Transducer Name für Feuchtigkeit | Humidity |
| nameTemp | X | XDR transducer Name für Temperatur | TempAir |
| nameRoll  (ab 20220421) | X | XDR transducer Name für Roll | Roll |
| namePitch  (ab 20220421) | X | XDR transducer Name für Pitch | Pitch |
| enabled | X |  |  |
| priority | X |  |  |

### AVNTrackWriter

Schreiben von Tracks im gpx Format und einem simplen ASCII Format.
Kategorie 3 (einmal, optional)

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| interval | X | minimaler Abstand in s zwischen dem Schreiben von 2 Einträgen | 10 |
| mindistance | X | minimaler Abstand in m zwischen 2 Track Punkten | 50 |
| trackdir | X | Verzeichnis für tracks | <datadir>/tracks |
| cleanup | X | Maximale Länge des intern vorgehaltenen Tracks in Stunden. Trackdaten werden weiter in Dateien geschrieben, aber die App kann maximal diese Zeit (rückwärts) als Track bekommen. | 25 |
| writeFile | X | Schreibe eine Track Datei. Wenn ausgeschaltet Aufzeichnung nur im Speicher. | ein |

### AVNRouter

Verwalten von Routing Daten (Wegpunkte, Routen, Ankeralarm). Berechnung
der AP Daten. Kategorie 1 (einmal, erforderlich).

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| name | X | Kanalname (genutzt für AP Daten) | intern berechnet |
| routesdir |  | Verzeichnis für routen | <datadir>/routes |
| interval | X | Intervall (in s) zwischen RMB Datensätzen | 5 |
| computeRMB | X | berechne einen RMB Datensatz wenn ein Wegpunkt aktiv ist | true |
| computeAPB | X | berechne einen APB Datensatz | false |
| useRhumbLine  (ab 20220819) | X | benutze den [rhumb line Modus](../quickstart.md#routes) für Routen | false |
| nextWpMode  (ab 20220819) | X | Auswahl des [Weiterschaltungs-Modus für den nächsten Wegepunkt](../quickstart.md#nextwp) in einer Route (late, 90, early) | late |
| nextWpTime  (ab 20220819) | X | Die Wartezeit nach dem Wegepunktalarm (in Sekunden) bis zur Weiterschaltung zum nächsten Wegepunkt (nur nextWpMode = early) | 10 |

### AVNNmeaLogger

Schreibt NMEA logs in das track Verzeichnis. Kategorie 3 (einmal,
optional).

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| maxfiles | X | Anzahl der Dateien (1 pro Tag), die aufgehoben werden | 100 |
| filter | X | [filter](#filter) für NMEA Daten | "$RMC,$DBT,$DBP" |
| interval | X | Minimale Zeit in s bevor ein Satz des gleichen Typs erneut geschrieben wird | 5 |
| enabled | X |  |  |

### AVNImporter

Importiert Karten, die noch konvertiert werden müssen. Kategorie 2
(einmal, nicht notwendig)

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| filesettle | X | Zeit in s, die nach dem Finden einer Datei im Import-Verzeichnis gewartet wird, bevor der Konverter startet | 30 |
| dirsettle | X | Zeit in s, die nach dem Finden eines Verzeichnisses im Import-Verzeichnis gewartet wird, bevor der Konverter startet | 10 |
| scanInterval |  | Zeit (in s) zwischen 2 automatsichen Scans des Import Verzeichnisses. 0: kein automatischer Scan (aber ausgelöst beim Hochladen) | 0 |
| enabled | X |  |  |

### AVNWpaHandler

Konfiguration von externen WLAN Verbindungen. Kategorie 3 (einmalig,
optional)

|  |  |  |
| --- | --- | --- |
| Name | Beschreibung | default/template |
| wpaSocket | die Steuerverbindung zu wpa\_supplicant | /var/run/wpa\_supplicant/wlan-av1 |
| ownSsid | eigene SSIDs, diese werden ausgeblendet | avnav,avnav1,avnav2 |
| firewallCommand | wenn konfiguriert, kann damit der externe Zugriff über ein WLAN freigeschaltet werden | sudo -n $BASEDIR/../raspberry/iptables-ext.sh wlan-av1 |
|  |  |  |

### AVNCommandHandler

Ausführen von Kommandos, u.a. für Alarme. Kategorie 2 (einmalig, nicht
notwendig).

Der AVNCommandHandler selbst hat keine Parameter. Es können jedoch
verschiedene Kommandos konfiguriert werden, die dann jeweils per Name
angesprochen werden. Die default Konfiguration ist:

```
<AVNCommandHandler>
<Command name="sound" command="mpg123 -q" repeat="1"/>
</AVNCommandHandler>
```

#### Parameter für Command

|  |  |  |
| --- | --- | --- |
| Name | Beschreibung | default/template |
| name | Name des Kommandos |  |
| command | Auszuführender Befehl |  |
| repeat | Zahl der Wiederholungen | 1 |

### AVNAlarmHandler

Management von Alarmen. Kategorie 2 (einmal, nicht notwendig).

Stark verändert ab 20220421.

Die default Konfiguration ist:

```
<AVNAlarmHandler>
<Alarm name="waypoint" category="info" repeat="1"/>  
 <Alarm name="connectionLost" category="info" repeat="1"/>
<Alarm name="anchor" category="critical" repeat="20000"/>
<Alarm name="gps" category="critical" repeat="20000"/>
<Alarm name="mob" category="critical" repeat="2"/>  
</AVNAlarmHandler>
```

Ab der Version 20220421 sollten vorhandene Alarm-Einträge in
avnav\_server.xml gelöscht werden, falls nicht ein spezielles Kommando dort
eingetragen werden soll.  
Damit können die Sounds über die Sound Auswahl für die Kategorie definiert
werden.

Falls mit Alarmen spezielle Kommandos ausgelöst werden sollen, können
diese jedoch in der avnav\_server.xml explizit gesetzt werden.

```
<AVNAlarmHandler>  
 <!-- legacy way of configuring alarms - still supported but not recommended, use category at least and optionally parameter -->
<Alarm name="gps" category="critical" command="gpsAlarm" parameter="$BASEDIR/../sounds/anchorAlarm.mp3" repeat="20000"/>  
 <!-- with the next line we configuer a special command that will be called when we receive a "sinking" notification from SignalK  
 the sound is determined by the category - and this is also the parameter that the command will receive -->
<Alarm name="sk:sinking" command="sinkingAlarm" category="critical" repeat="2"/>  
</AVNAlarmHandler>
```

#### Parameter für Alarm

|  |  |  |
| --- | --- | --- |
| Name | Beschreibung | default |
| name | Name des Alarms | leer, erforderlich |
| category | Kategorie (info,critical) | leer |
| command | Kommando, das ausgeführt werden soll (muss bei AVNCommandHandler konfiguriert sein) | leer |
| autoclean | Schalte den Alarm ab, wenn das Kommando beendet wurde | aus |
| sound | Der Name einer Sound Datei - wenn angegeben wird diese genutzt (relative Namen beziehen sich auf das interne Sound Verzeichins oder auf das user-Verzeichnis).  Wenn nicht gesetzt, wird der sound aus der Kategorie ermittelt oder wenn nicht gesetzt aus dem 'parameter' | leer |
| repeat | Anzahl der Kommando (und sound) Wiederholungen | 1 |
| parameter | Falls angegeben wird dieser Parameter dem Kommando übergeben. Falls weder sound noch category gesetzt sind, wird der Name als der Pfad zu einer Sound-Datei interpretiert. |  |

#### Parameter für AlarmHandler

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| infoSound | X | Name einer mp3 Datei für den Sound in der Kategorie info.  Kann aus einer Liste von eingebauten sounds und Dateien im user-Verzeichnis gewählt werden (über Download Seite hochladbar) | waypointAlarm.mp3 |
| criticalSound | X | Name einer mp3 Datei für den Sound in der Kategorie critical.  Kann aus einer Liste von eingebauten sounds und Dateien im user-Verzeichnis gewählt werden (über Download Seite hochladbar) | anchorAlarm.mp3 |
| defaultCommand | X | Kommando für Alarme die nicht explizit ein Komando definiert haben.  Dieses Kommando muss beim AVNCommandHandler konfiguriert werden. | sound |
| stopAlarmPin | X | Nur auf Raspberry Pi. Wenn gesetzt (board Nummerierung), schaltet ein Low an diesem Pin Alarme aus.  Ab Version 2025xxxx gibt es ein separates plugin "[resetAlarm](#pluginResetAlarm)" und eine Konfiguration muss dort erfolgen. Eine vorhandene Einstellung wird bei der Installation migriert. | leer |

### AVNPluginHandler {: #plugins}

Management von plugins. Kategorie 2 (einmalig, optional).  
Der AVNPluginHandler verwaltet [Plugins](plugins.md), die in
verschiedenen Verzeichnissen installiert werden können. Es gibt 3
Verzeichnisse in denen Plugins gesucht werden:

* builtin: /usr/lib/avnav/server/plugins
* system: /user/lib/avnav/plugins
* user: /home/pi/avnav/data/plugins

Neben den Parametern für den Plugin Handler selbst können die jeweiligen
Plugins Parameter erwarten. Der Name für das Plugin ergibt sich dabei aus
der Kategorie und dem plugin Verzeichnis. Beispiel:

```
<AVNPluginHandler>
<builtin-signalk enabled="true"/>
<builtin-canboat enabled="true" allowKeyOverwrite="true" autoSendRMC="30" sourceName="canboatgen"/>
</AVNPluginHandler>
```

#### Parameter für AVNPluginHandler

|  |  |  |
| --- | --- | --- |
| Name | Beschreibung | default/template |
| builtinDir | Verzeichnis für eingebaute Plugins, nicht änderbar | /usr/lib/avnav/server/plugins |
| systemDir | Verzeichnis für Plugins, die als separate Pakete installiert werden | /usr/lib/avnav/plugins |
| userDir | Verzeichnis für Nutzer Plugins | /home/pi/avnav/data/plugins |

#### Parameter für [builtin-canboat](CanboatAndSignalk.md)

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| enabled | X | Nur wenn auf true, ist das Plugin aktiv | aus |
| allowKeyOverride | X | Muss gesetzt werden, wenn Datum und Zeit von canboat gelesen werden sollen | aus |
| port | X | canboat json Port | 2598 |
| host | X | Host für den n2kd | localhost |
| autoSendRMC | X | falls für diese Zeit in Sekunden kein RMC im NMEA-Datenstrom gesehen wird, aber gültige Positionsdaten + Zeit von canboat vorhanden sind: sende RMC (ist wichtig für Datum/Zeit auf NMEA0183) | 0 (aus) |
| readPos | X | Lese die Position von PGN 129025 und cog/sog von PGN 129026 | ein |
| sourceName | X | Kanalname, der für RMC genutzt wird | plugin-Name |
| timeInterval | X | minimale Zeit zwischen 2 NMEA2000 Zeit Werten, bevor diese gespeichert werden (Sekunden) | 0.5 |
| timePGNs | X | PGNs, die für das Setzen der Zeit genutzt werden | 126992,129029 |

#### Parameter für system-resetAlarm (nur mit dem Paket avnav-raspi) {: #pluginResetAlarm}

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default |
| gpio | X | GPIO pin (Bord Nummerierung) an dem ein Taster zum Rücksetzen von Alarmen angeschlossen ist | -- |
| lowActive | X | Wenn gesetzt ist der Eingang L-aktiv, d.h. die Alarme werden mit einem L an diesem Eingang zurück gesetzt | true |
| pullUpDown | X | Wenn gesetzt wird für den Eingang ein pull-up bzw. pull-down Widerstand aktiviert, so dass nur ein externer Taster angeschlossen werden muss. | true |

### AVNChartHandler

Verwaltung der Karten. Kategorie 2 (einmal, muss nicht enthalten sein)

|  |  |  |
| --- | --- | --- |
| Name | Beschreibung | default/template |
| period | Zeitintervall zwischen 2 Lesevorgängen für das Kartenverzeichnis (Sekunden) | 30 |
| upzoom | Anzahl von zoom Stufen über der höchsten vorhandenen Stufe | 2 |

### AVNUserHandler

Verwaltung der Nutzer-Dateien. Kategorie 2 (einmal, muss nicht enthalten
sein)

|  |  |  |
| --- | --- | --- |
| Name | Beschreibung | default/template |
| interval | Zeitintervall zwischen 2 Lesevorgängen für das Verzeichnis (Sekunden) | 5 |

### AVNImagesHandler

Verwaltung der Nutzer-Images. Kategorie 2 (einmal, muss nicht enthalten
sein)

|  |  |  |
| --- | --- | --- |
| Name | Beschreibung | default/template |
| interval | Zeitintervall zwischen 2 Lesevorgängen für das Verzeichnis (Sekunden) | 5 |

### AVNUserAppHandler

Verwaltung der konfigurierten [User
Apps](../userdoc/addonconfigpage.md). Kategorie 2 (einmal, muss nicht enthalten sein)

Dieser Handler ist etwas speziell. Initial sind hier keine
Konfigurationen zu finden, über die WebApp können aber Konfigurationen
angelegt werden. Eine händische Änderung ist nicht empfohlen.

### AVNAvahiHandler

Steuert die Registrierung von AvNav bei Avahi(MDNS/Bonjour).

|  |  |  |  |
| --- | --- | --- | --- |
| Name | online | Beschreibung | default/template |
| serviceName | X | Der Name der in Tools sichtbar wird.  Das ist nicht der Host Name, den man z.B. in avnav.local benutzt! | avnav |
| maxRetries | X | Wie viele Wiederholungen macht AvNav, wenn der gewählte Name bereits vergeben ist. Wiederholungen hängen ein "-nn" suffix an den Namen an. | 20 |
| timout | X | Timeout bei der Verbindung mit dem  avahi daemon (s) | 10 |
| enabled | X |  |  |

### AVNSignalKHandler

Neu mit 20220421.  
Für eine Beschreibung siehe die [SignalK
Dokumentation](CanboatAndSignalk.md#configuration).