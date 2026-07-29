---
  tags:
    - Nmea2000
    - SignalK
---
Zusammenwirken mit SignalK
==========================


![SignalK](../../img/SignalK.png)

## SignalK Daten in AvNav
Die Raspberry-, Linux- und Windows Version von AvNav können auf direktem Weg Daten von [SignalK](https://signalk.org/) empfangen und auch Daten dorthin schicken.

Alle Versionen von AvNav können NMEA0183 Daten von [SignalK](https://signalk.org/) empfangen und dort hin schicken.

Es gibt dabei verschiedene Optionen, wie die Daten von SignalK in AvNav verarbeitet und genutzt werden.

### NMEA0183 Daten
Diese Daten durchlaufen ganz normal den [Multiplexer](TODO) und [Decoder](TODO) in AvNav und die dekodierten Daten können zur Navigation und Anzeige genutzt werden - genauso, wie alle anderen empfangenen NMEA Daten.

Da AvNav alle NMEA Daten auch an Schnittstellen (TCP, UDP, Seriell,...) bereitstellt, können auf diesem Weg auch Daten zu SignalK gesendet werden.

### Direkte SignalK Daten
AvNav kann auch (in der Raspberry-, Linux- und Windows-Version) direkt die Schnittstellen des SignalK Servers nutzen und von dort Daten empfangen und senden. In AvNav gibt es dazu einen SignalK Handler (erreichbar über {{BT("MainNav")}} -> Connections/Devices), der [konfiguriert](#configuration) werden kann.
Die empfangenen Daten können dabei auf verschiedene Weise genutzt werden - je nach der Konfiguration:

1.  "decodeData" ausgeschaltet:
    Alle SignalK Daten von `vessels.self` (eigenes Schiff) werden in AvNav als __zusätzliche__ Daten unter `nav.gps.signalk...` bereitgestellt und können nur in [Anzeigen](../base/layout.md) genutzt werden. Sie können nicht für die Navigation genutzt werden.Das macht natürlich nur Sinn, wenn die für die Navigation benötigten Daten AvNav auf anderen [Wegen](#dataflow) erreichen.
    {: #addon}

2. "decodeData" eingeschaltet:
   Die SignalK Daten werden zusätzlich für die Navigation genutzt und zu den entsprechenden Daten in AvNav [umgewandelt](#mapping). 
   {: #decode}

Für weitere Details siehe unter [Konfiguration](#configuration).

## Datenfluss {: #dataflow}
Je nach Nutzer Vorlieben und fertigen Systemkonfigurationen gibt es also mehrere Möglichkeiten, wie Daten zwischen AvNav und SignalK fliessen können. Um Probleme zu vermeiden (insbesondere auch Schleifen bei denen Daten z.B. von SignalK kommen und dann auf anderem Weg wieder dorthin zurück geschickt werden), sollte man sich daher für einen grundsätzlichen Datenfluss entscheiden:

1. NMEA-Daten landen zunächst in AvNav und werden von dort zu SignalK
   weiter geleitet. Dieses Setup wird in den [AvNav Headless Images](../installation/raspberry.md#images) genutzt. 
   SignalK-Daten, die noch nicht in AvNav vorhanden sind (z.B. Sensoren) können (über den SignalK handler als [zusätzliche Daten](#addon)) wieder zu AvNav geschickt werden und dann dort auch angezeigt werden.  
   Die Daten, die AvNav zur Navigation nutzt (inklusive der AIS Daten),
   werden hier direkt von AvNav aus den NMEA-Daten dekodiert.  
   NMEA2000-Daten wird man normalerweise immer auch direkt zu SignalK schicken, damit diese dort direkt dekodiert werden können. AvNav kann diese Daten über [Canboat](#Canboat) empfangen - oder von SignalK erhalten (dann erzeugt man aber einen gemischten Fluss und muss sicherstellen, das man keine Schleifen erzeugt)

2. NMEA-Daten landen zunächst in SignalK und können von dort per
   [Signalk Handler](#decode) zu AvNav weiter geleitet werden.  
   Das ist das Setup, was z.B. in OpenPlotter verwendet wird.

Für beide Varianten kann AvNav auch eigene Daten an SignalK schicken. Im
Moment sind das die Routing-Daten zum nächsten Wegepunkt (entweder als
RMB/APB NMEA0183-Daten oder als SignalK Update - s.u.).

Außerdem können Notifications (Alarme) von SignalK gelesen und dorthin
gesendet werden.


### 1. NMEA zu AvNav und von dort zu SignalK {: #flow1}

Die Konfiguration ist in den [AvNav Headless Images](../installation/raspberry.md#images) vorbereitet.

Für diese Konfiguration ist in AvNav ein AVNSocketWriter vorgesehen
(Standard: port 34568), der empfangene NMEA-Daten weiterleitet. Über
Blacklist-Einträge werden Daten von canboat (NMEA2000) nicht mit
ausgesendet.

```
<AVNSocketWriter port="34568" maxDevices="5" filter="" read="true" minTime="50" name="nmea0183tosignalk" blackList="canboatnmea0183,canboatgen"/>
```

In SignalK muss dazu eine entsprechende data connection für NMEA0183, TCP
client zu Port 34568 angelegt werden (in den images bereits angelegt).

Der AVNSignalKHandler ist per default so konfiguriert, dass er SignalK
über localhost:3000 erreicht und alle Daten von vessels.self liest. Diese
werden dann unter gps.signalk,... in AvNav abgespeichert und können so in
[Anzeigen](layouts.md) verwendet werden.  
Dabei wird eine Mischung aus polling per HTTP-Json und einer Websocket-Verbindung genutzt. Das Polling sorgt für eine sichere Aktualisierung, die
Websocket-Verbindung für ein zeitnahes Update.

Auf der obigen SocketWriter-Verbindung schickt AvNav auch seine Routing-Daten als RMB- bzw. APB-Sätze zu SignalK.  
Zusätzlich kann beim SignalKHandler noch die Integration von Alarmen
(SignalK: Notifications) aktiviert werden.

Daten, die über andere Wege direkt in SignalK ankommen, werden zwar wie
beschrieben zu AvNav geleitet, **sind dort jedoch nicht direkt für die
Navigation nutzbar**.

Wenn man möchte, dass Daten zunächst in SignalK ankommen und von dort zu AvNav weiter gehen, sollte man überlegen, ob der andere Signalfluss (2) nicht besser geeignet ist..

Vorteil an Signalfluss 1 (NMEA erst zu AvNav) ist , das auch, wenn SignalK
nicht verfügbar ist oder Probleme macht, die Navigationsfunktionen von
AvNav noch arbeiten können.

### 2. NMEA-Daten zuerst zu SignalK {: #flow2}

In diesem Signalfluss, der unter OpenPlotter der Default ist (ab AvNavInstaller
Version xxxx), werden NMEA Daten zunächst in SignalK empfangen und
gespeichert. Dazu müssen in SignalK die entsprechenden data connections
konfiguriert werden.

In AvNav wird der AVNSignalKHandler so konfiguriert, dass er die Daten von
SignalK in einer Kombination von HTTP-Json und einer Websocket-Verbindung
abholt.  
Es sind die Flags "decodeData" und "fetchAis" (siehe [Konfiguration](#configuration))
gesetzt. Damit werden empfangene Daten intern in AvNav für die Navigation
gespeichert. Zusätzlich werden sie wie bei [(1)](#flow1) noch
einmal unter gps.signalk.... gespeichert, damit die Anzeigen genauso
funktionieren.  
Für das Mapping der Daten siehe [[Mapping](#mapping)].

Im AVNSignalKhandler ist außerdem das Senden von Daten aktiviert
("sendData"). Es werden die Daten für den aktuellen Wegepunkt sowie Alarme
zu SignalK gesendet.  
Außerdem werden Notifications von SignalK empfangen.  
Für das Schreiben von Daten zu SignalK muss ein unter SignalK verfügbarer
Nutzer mit Schreibrechten konfiguriert werden (siehe [Konfiguration](#configuration)).


### Auswahl des Datenflusses

Für die Entscheidung, ob der [Datenfluss 1](#flow1) (erst zu
AvNav) oder der [Datenfluss 2](#flow2) (erst zu SignalK)
genutzt werden soll, kann man zunächst von den defaults ausgehen, je
nachdem, auf welcher Basis man aufsetzt.

Man sollte nur dann davon abweichen, wenn es gute Gründe dafür gibt.
Durch Konfiguration auf der Seite Connections/Devices 
 ({{BT('MainNav')}} -> Connections/Devices)
kann man jeden dieser Flüsse einstellen, es sind sogar
Mischformen möglich.

Man muss dabei nur darauf achten, dass man keine Schleifen erzeugt - also
z.B. Daten von AvNav per NMEA0183 zu SignalK schickt und diese dann wieder
von dort zurückholt.  
AvNav versucht, solche Probleme mit einer "sourcePriority" an jeder
Verbindung zu vermeiden. Alle NMEA-Verbindungen haben per default eine
Priority von 50, der AVNSignalKHandler 40 - damit "gewinnen" direkt
empfangene NMEA Daten immer gegenüber den von SignalK geholten Daten.

### Konfiguration {: #configuration}

Der AVNSignalK Handler hat die folgenden Konfigurationen.

|  |  |  |
| --- | --- | --- |
| Name | Beschreibung | Default |
| name | Ein Name für den Handler. Wird auf der Status-Seite angezeigt und im Log verwendet. | leer (signalk) |
| enabled | Wenn ausgeschaltet, wird die SignalK-Integration deaktiviert. Ggf. konfigurierte NMEA-Verbindungen sind davon nicht betroffen. | ein |
| decodeData | Wenn eingeschaltet, werden die empfangenen Daten von SignalK auch für die Navigationsfunktionen in AvNav verwendet. Siehe [Mapping](#mapping). | aus (ein auf OpenPlotter) |
| fetchAis | Wenn eingeschaltet, werden alle 10s (aisQueryPeriod) die AIS-Daten von SignalK geholt und in AvNav als AIS-Daten gespeichert. | aus (ein auf OpenPlotter) |
| priority | Die Priorität der dekodierten SignalK-Daten | 40 |
| port | Der SignalK HTTP Port. | 3000 |
| host | Der SignalK server hostname/die IP-Adresse. | localhost |
| aisQueryPeriod | Intervall (in s) für die Abfrage der AIS-Daten | 10 |
| period | Periode in ms für die HTTP-Json-Abfrage auf SignalK. Wenn die python websocket-Bibliotheken verfügbar sind (der Normalfall), wird dieses Intervall auf nahezu die expiryTime der Daten in AvNav vergrößert. | 1000 |
| fetchCharts | Hole die Informationen über die bei SignalK installierten Karten. Dazu muss dort der signalk-chart-provider installiert sein. | ein |
| chartQueryPeriod | Intervall (in s) für die Abfrage der Karten. | 10 |
| chartProxyMode | Wenn SignalK auf einem anderen Rechner läuft als AvNav, kann es sein, dass der Browser diesen anderen Rechner nicht direkt erreichen kann. Daher besteht die Möglichkeit, dass das Laden der Karten über einen Proxy in AvNav erfolgt. Das erzeugt allerdings etwas zusätzliche Last und kann daher abgeschaltet werden.  *sameHost*: nur Proxy, wenn SignalK nicht auf dem gleichen Server läuft wie AvNav  *never*: kein Proxy (kann genutzt werden, wenn auch vom Browser aus der SignalK Server unter der hier eingetragenen Adresse erreicht werden kann)  *always*: Immer proxy. Kann genutzt werden, wenn der SignalK Port (3000) nicht direkt von außerhalb erreichbar ist. | sameHost |
| ignoreTimestamp | Im Normalfall wertet der Handler den Timestamp der SignalK Daten aus und ignoriert Daten, die zu alt sind (expiryPeriod in AVNConfig). Eine potenzielle Zeitdifferenz zwischen dem eigenen Server und dem SignalK Server wird dabei berücksichtigt.  SignalK nutzt allerdings manchmal nicht seine lokale Zeit als Basis für diesen Zeitstempel, sondern nimmt den Zeitstempel aus empfangenen Daten. Der kann insbesondere bei der Verwendung von Simulationsdaten weit in der Vergangenheit liegen - und AvNav würde solche Daten ignorieren.  Durch Setzen dieses Flags ignoriert AvNav diese Zeitstempel und trägt als Zeitstempel seine lokale Zeit der letzten Änderung eines Wertes ein.  Das ist natürlich nicht so genau wie der originale Zeitstempel in SignalK, führt aber dazu, das auch ältere Simulationsdaten genutzt werden könen. | aus |
| sendData | Sende Daten an SignalK.  Es kann jeweils noch konfiguriert werden, ob Alarme oder/und Wegepunkt-Daten gesendet werden können. Diese Einstellungen werden aber erst sichtbar, wenn sendData aktiviert wurde.  Das steuert **nicht das Senden von NMEA-Daten** zu SignalK! | aus (ein auf OpenPlotter) |
| userName | Der Name eines SignalK-Nutzers mit Schreibrechten auf dem SignalK Server. Dieser Nutzer muss vorher mit den entsprechenden Rechten bei SignalK angelegt worden sein.  Leider hat SignalK kein Interface, um direkt prüfen zu können, ob ein bestimmter Nutzer die gewünschten Pfade schreiben kann, nur für "localhost" wird geprüft, ob Schreibrechte vorliegen. | admin |
| password | Das Passwort für den konfigurierten Nutzer. Dieses Passwort ist im Normalfall für eine SignalK-Installation auf dem gleichen Server nicht erforderlich (sofern die Konfiguration auf dem Standardpfad $HOME/.signalk/security.json liegt).  Wenn in der Status-Anzeige unter "authentication" ein Fehler auftritt, kann u.U. auch lokal das Setzen des Passwortes das Problem lösen.  Achtung: Das Passwort wird im Klartext in der avnav\_server.xml gespeichert. | <leer> |
| sendWp | Sende Wegepunkt-Daten zu SignalK. Siehe auch [Mapping](#mapping). | ein |
| sendNotifications | Sende AvNav-Alarme als Notifications zu SignalK - siehe [Mapping](#mapping). | ein |
| receiveNotifications | Empfange Notifications von SignalK als Alarme. | aus |
| notifyWhiteList | Eine Komma-separierte Liste von SignalK notifications, die emfangen werden sollen. Anzugeben sind jeweils die Pfade ohne "notification." - als z.B. navigation.arrivalCircleEntered,mob,fire,sinking.  Wenn die Liste leer ist, werden alle Notifications empfangen - aber es wird noch die notificationBlacklist betrachtet, | <leer> |
| notifyBlackList | Eine Komma-separierte Liste von SignalK notifications, die nicht empfangen werden sollen. | server.newVersion |
| webSocketRetry | Interval (in s), in dem versucht wird, eine erneute Websocket-Verbindung aufzubauen, wenn die vorige geschlossen wurde. | 20 |


Einige der Parameter werden erst sichtbar, wenn der jeweils
"übergeordnete" Parameter aktiviert wurde.

  

### Mapping {: #mapping}

Die SignalK-Pfade werden wie folgt auf AvNav-Datenpfade gemappt:

/vessels/self/... => gps.signalk....

Diese Pfade werden in AvNav intern nicht verwendet, können aber angezeigt
werden.

Wenn "decodeData" aktiviert ist, wird wie folgt gemappt (siehe [im
code](https://github.com/wellenvogel/avnav/blob/c67ee491bc19d579f379eb78bcde149282806ab2/server/avnav_nmea.py#L122)).

Anmerkung: Kurse/Winkel werden intern in AvNav in ° gespeichert, in
SignalK in rad. Wenn mehrere SignalK-Pfade angegebn sind, wird der jeweils
erste bei SignalK vorhandene genutzt.

|  |  |
| --- | --- |
| SignalK unter /vessels/self/ | AvNav |
| navigation.headingCompass | gps.headingCompass |
| navigation.headingMagnetic | gps.headingMag |
| navigation.headingTrue | gps.headingTrue |
| environment.water.temperature | gps.waterTemp |
| navigation.speedThroughWater | gps.waterSpeed |
| environment.wind.speedTrue | gps.trueWindSpeed |
| environment.wind.speedApparent | gps.windSpeed |
| environment.wind.angleApparent | gps.windAngle |
| environment.wind.angleTrueWater (since 20240520) | gps.trueWindAngle |
| navigation.position.latitude | gps.lat |
| navigation.position.longitude | gps.lon |
| navigation.courseOverGroundTrue | gps.track |
| navigation.speedOverGround | gps.speed |
| environment.depth.belowTransducer | gps.depthBelowTransducer |
| environment.depth.belowSurface | gps.depthBelowWaterline |
| environment.depth.belowKeel | gps.depthBelowKeel |
| navigation.datetime | gps.time |
| navigation.gnss.satellitesInView.count | gps.satInview |
| navigation.gnss.satellites | gps.satUsed |
| navigation.magneticDeviation (since 20240520) | gps.magDeviation |
| navigation.magneticVariation (since 20240520) | gps.magVariation |
| environment.current.setTrue (since 20240520) | gps.currentSet |
| environment.current.drift (since 20240520) | gps.currentDrift |

AIS-Daten werden wie folgt gemappt ("fetchAis" ein):

|  |  |  |
| --- | --- | --- |
| SignalK vessels/\*/ | AvNav ais | Bemerkung |
| mmsi | mmsi | nur wenn mmsi gesetzt ist, werden die Daten übernommen |
| name | shipname |  |
| navigation.speedOverGround | speed |  |
| navigation.courseOverGroundTrue | course |  |
| communication.callsignVhf | callsign |  |
| design.aisShipType | shiptype |  |
| navigation.position.longitude | lon |  |
| navigation.position.latitude | lat |  |
| navigation.destination | destination |  |
| sensors.ais.class | type | class A -> type 1  class B -> type 18  other -> type other |
| design.beam | beam |  |
| design.length | length |  |
| design.draft | draught |  |
| navigation.state | status |  |
| navigation.headingTrue | heading |  |
| atonType | aid\_type |  |

Wenn "sendWp" aktiv ist, werden die
Daten wie folgt gemappt:

|  |  |
| --- | --- |
| AvNav | SignalK vessels/self/ |
| currentLeg.to.lon | navigation.courseGreatCircle.nextPoint.position.longitude  und  navigation.courseGreatCircle.nextPoint.longitude |
| currentLeg.to.lat | navigation.courseGreatCircle.nextPoint.position.latitude  und  navigation.courseGreatCircle.nextPoint.latitude |
| currentLeg.from.lon | navigation.courseGreatCircle.previousPoint.position.longitude |
| currentLeg.from.lon | navigation.courseGreatCircle.previousPoint.position.latitude |
| currentLeg.distance | navigation.courseGreatCircle.nextPoint.distance |
| currentleg.dstBearing | navigation.courseGreatCircle.nextPoint.bearingTrue  und  navigation.courseGreatCircle.bearingToDestinationTrue |
| currentLeg.xte | navigation.courseGreatCircle.crossTrackError |
| currentLeg.approachDistance | navigation.courseGreatCircle.nextPoint.arrivalCircle |
| currentLeg.bearing | navigation.courseGreatCircle.bearingTrackTrue  und  navigation.courseGreatCircle.bearingOriginToDestinationTru |

Wenn der AvNav Routing Mode Rhumbline ist, wird  "courseGreatCircle"
durch "courseRhumbline" ersetzt. Das mehrfache Senden einiger Werte mit
anderen Pfaden ist ein Workaround für einige SignalK-Fehler(wie <https://github.com/SignalK/signalk-to-nmea2000/issues/94>).

Für Notifications gibt es einige wenige Mappings, ungemappte
Notifications werden in AvNav mit ihrem Namen und "sk:" vorangestellt
gehandelt. Also z.B. notifications.sinking wird zu sk:sinking.

|  |  |  |
| --- | --- | --- |
| AvNav | SignalK vessels/self/notifications | Value |
| mob | mob | state:emergency,   method:visual,sound,   message:man overboard |
| waypoint | arrivalCircleEntered | state: normal,  method: visual,sound,  message: arrival circle entered |
| anchor | navigation.anchor | state:emergency,  method: visual,sound,  message: anchor drags |

SignalK Notifications ohne ein direktes Mapping werden basierend auf
ihrem state einer Kategorie zugeordnet (darüber kann im AVNCommandHandler
das auszuführende Kommando und der Sound definiert werden). 

emergency -> critical

alert -> info

warn -> alarm

alarm -> alarm

Im AVNAlarmHandler können auch weitere Alarme [konfiguriert ](configfile.md#AVNAlarmHandler) werden (als Name muss dan sk:name verwendet werden). Diese werden dann entsprechend ihrer konfiguration behandelt.

### SignalK - Karten {: #SignalKCharts}

Ab Version 202011xx ist auch der [SignalK
chart provider](https://github.com/SignalK/charts-plugin) integriert. Karten, die von dort angeboten werden,
können auf der Einstiegsseite ebenfalls ausgewählt werden. Dazu muss
natürlich innerhalb von SignalK das entsprechende Plugin installiert und
aktiviert sein - und Karten müssen dort verfügbar sein.

Im Normalfall werden durch AvNav nur die Informationen über die Karten
bereitgestellt, der Zugriff auf die Karten erfolgt direkt vom Browser zu
SignalK.

Falls das z.B. durch Firewall-Einstellungen verhindert wird, kann man
auch alle Karten-Zugriffe über AvNav leiten (Proxy) - siehe [Konfiguration](#configuration).

  