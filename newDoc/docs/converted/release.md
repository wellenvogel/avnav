Releases



Avnav Releases
==============

Das Verzeichnis mit allen Releases findet man [hier](../downloads/release/).  

Hinweise
--------

[Die Installationsanleitung](install.md)
enthält eine detaillierte Beschreibung der Installationsoptionen. Auf dieser
Seite finden sich Informationen zu den einzelnen Release-Versionen.  
Nicht mit jedem Update werden neue Images bereitgestellt. Zwischen-Updates
sind entweder [Entwickler-Versionen](../downloads/daily/) oder [Releases](../downloads/release/).  
Um ein solches Update zu installieren, benötigt man eine Kommandozeile auf
dem pi (oder das [AvNav
Update Plugin](https://github.com/wellenvogel/avnav-update-plugin)). Von Windows aus geht das z.B. mit [putty](https://www.putty.org/). Dazu die IP Adresse vom pi ermitteln und dann mit putty dorthin
verbinden. Nutzername: pi, Passwort: raspberry (bzw. so, wie man das für das
Image angepasst hat).  
Wie man die Pakete installiert, ist ebenfalls in der [Installationsanleitung](install.md#Packages)
beschrieben.  
Anschliessend muss man (Hinweise auf dieser Seite beachten) eventuell noch
die Konfigurationsdatei  
```
/home/pi/avnav/data/avnav_server.xml
```
anpassen. Dass kann man z.B. so machen:  
  
```
sudo systemctl stop avnav
nano /home/pi/avnav/data/avnav_server.xml # dann ändern und speichern
sudo systemctl start avnav
```
  

Wenn man das [AvNav
Update Plugin](https://github.com/wellenvogel/avnav-update-plugin) installiert hat, kann man die Konfiguration auch von
dort bearbeiten ohne die Kommandozeile nutzen zu müssen.

Auf dieser Seite sind nur Hinweise zu den [release-Versionen](../downloads/release/)
enthalten, für [tägliche Builds](../downloads/daily/) kann man
die [commits
auf GitHub](https://github.com/wellenvogel/avnav/commits/master) prüfen.

  

Versionen
---------

20250822 [link](../downloads/release/20250822 "release/20250822")

***Fehlerkorrekturen für 20250723***

* [#498](https://github.com/wellenvogel/avnav/issues/498):
  various errors in AIS computations
* [#497](https://github.com/wellenvogel/avnav/issues/497):
  correctly show +/- 180° in wind displays
* [#431](https://github.com/wellenvogel/avnav/issues/431):
  AvNav not displaying AIS vessel names
* [#501](https://github.com/wellenvogel/avnav/issues/501):
  Wrong layoutName in settings
* [#458](https://github.com/wellenvogel/avnav/issues/458):
  Android Install doesn't offer to update beta
* [#503](https://github.com/wellenvogel/avnav/issues/503):
  Removing overlay not working
* [#495](https://github.com/wellenvogel/avnav/issues/495):
  Wrong waypoint names
* [#504](https://github.com/wellenvogel/avnav/issues/504):
  AIS targets with SOG 0 has wrong COG orientation on display
* [#499](https://github.com/wellenvogel/avnav/issues/499):
  settime issue: system time doesn't get set
* [#500](https://github.com/wellenvogel/avnav/issues/500):
  AvNav Updater page gets trunctated in 100% zoom
* [#507](https://github.com/wellenvogel/avnav/issues/507):
  Android Anchor Watch: radius (m) - changes ignored
* [#510](https://github.com/wellenvogel/avnav/issues/510):
  warn the user if battery optimization is not switched off for AvNav
* [#511](https://github.com/wellenvogel/avnav/issues/511):
  UDP reader on Android only listens exclusively on port
* [#512](https://github.com/wellenvogel/avnav/issues/512):
  Android: no Background Position when starting with internal GPS enabled
  or without GPS permissions
* [#514](https://github.com/wellenvogel/avnav/issues/514):
  correct documentation for user defined AIS images, allow status\* as
  wildcard - aisImage-Passenger-status\*
* [#515](https://github.com/wellenvogel/avnav/issues/515):
  Wrong unit in DST widget
* [#517](https://github.com/wellenvogel/avnav/issues/517):
  Map pinch zoom stops working on touch devices
* [#519](https://github.com/wellenvogel/avnav/issues/519):
  ocharts charts do not work as overlays on android
* Erweiterte [Auswahl
  für das Arbeitsverzeichnis](android/android.md#workingdirectory) (auch mit externer SD Karte) auf
  Android
* sowohl "start" und "goto" in der Feature Info für Routen
* Vermeide javascript Ladefehler (durch Hinzufügen eines
  Query-Parameters zur URL) beim reload
* Richtiges wifi country für hostapd und mit with raspi-config
  (Raspberry)
* Ermögliche das Disablen von NMEA0183 service reader wenn der Service
  momentan nicht verfügbar ist
* Korrektes Setzen aller initialen Einstellungen auf Android
* Crash Dialog auf Android

20250723 [link](../downloads/release/20250723 "release/20250723")

***Wichtige Änderungen***

* Die Berechnung von AIS Daten ist geändert. Sie basiert jetzt auf der
  geschätzten Ziel-Position. Für Detail siehe [AIS
  Berechnungen](userdoc/navpage.md#aiscomputations).  
  Das löst [#397](https://github.com/wellenvogel/avnav/issues/397),
  [#398](https://github.com/wellenvogel/avnav/pull/398).
* Die Funktion [Feature Info
  (Objekt Informartion)](userdoc/navpage.md#featurelist) hat sich verändert. Nach Klick auf die Karte
  erhält man jetzt zunächst eine Liste der Objekte an dieser Stelle und
  kann dann auswählen, für welches Objekt man die Details sehen möchte. Es
  gibt jetzt auch einen {{BT("CenterAction")}}"CenterAction" Button, der die gleiche
  Funktion auslöst, wie ein Klick auf den Kartenmittelpunkt (Fadenkreuz).
* Man hat mehr Flexibilität beim Anordnen von Anzeigen, besonders auf
  den [Dashboard Seiten](userdoc/dashboardpage.md) mit einem
  neuen [Combined Widget](hints/layouts.md#combinedwidget).
* Es gibt Verbesserungen im [Layout Editor](hints/layouts.md).
  Man kann jetzt Element frei per Drag und Drop zwischen den
  Anzeigepanelen verschieben. Ausserdem gibt es jetzt einen Undo (Roll
  Back) Button um die letzten Änderungen rückgängig zu machen.
* Einige Einstellungen wurden entfernt. Die meisten davon kann man im [Layout Editor](hints/layouts.md) setzen.  
  Um Systeme mit minimaler Sensorzahl zu unterstützen, gibt es jetzt eine
  neues minimales Layout (default-min).  

  |  |  |
  | --- | --- |
  | Entfernte Einstellung | Ersatz |
  | red/green Angle Wind | Man kann diese Werte jetzt am wind widget im Layout Editor setzen. |
  | relative motion vectors (AIS) | Relative Bewegsvektoren werden angezeigt, sobald "relative motion vector range (nm)"  != 0 ist |
  | show clock | Hinzufügen/Entfernen des ClockWidget im Layout Editor |
  | show zoom | Hinzufügen/Entfernen des Zoom Widget im Layout Editor |
  | show wind | Hinzufügen/Entfernen des WindWidget im Layout Editor |
  | show depth | Hinzufügen/Entfernen des DepthDisplay im Layout Editor |
  | wind knots | Man kann die Einheit als formatter Parameter an den Wind Widgets setzen |
  | Show Measure Button | Die Messfunktion is jetzt in die [Feature Info](userdoc/navpage.md#featurelist) integriert. |
  | Always Info on Chart Click | Es gibt jetzt nur noch "Feature Info on Click". Mit dieser Einstellung kann man die Anzeige der Feature Info beim Klick auf die Karte verhindern. Auch wenn das ausgeschaltet ist, kann man einen "Klick" auf den Kartenmittelpunkt (Fadenkreuz) mit dem  {{BT("CenterAction")}}"CenterAction" Button auslösen. |

  Wenn man eine Einstellungsdatei lädt, die solche entfernten
  Einstellungen enthält, bekommt man eine Warnung. Die Datei kann trotzdem
  geladen werden.
* Der [Edit Route
  Dialog](userdoc/editroutepage.md#routedialog) wurde verändert. Das
  Laden/Speichern/Verändern/Umbenennen/Erzeugen von Routen sollte damit
  einfacher sein. Die separate Seite zum Bearbeiten von Punkten einer
  Route wurde entfernt und die Funktion wurde in den Edit Route Dialog
  integriert.
* Die AIS Info Seite wurde durch einen [AIS
  Info Dialog](userdoc/navpage.md#aisinfo) ersetzt. Dieser Dialog wird angezeigt, wenn man in der
  [Feature Liste](userdoc/navpage.md#featurelist) (falls man
  in der Nähe eines AIS Ziels auf die Karte geklickt hat) eines der
  angezeigten AIS Ziele anklickt. Alternativ wird er auch beim Klick auf
  das AisTargetWidget angezeigt.
* Wenn man eine neue [User App](userdoc/addonconfigpage.md)
  erzeugt, kann man die nötige Icon-Datei direkt im Dialog hochladen.
  Ausserdem kann man auch die in AvNav eingebauten Icons in diesem Dialog
  auswählen. Das löst [#372](https://github.com/wellenvogel/avnav/issues/372):
  allow icon upload directly in user app dialog.
* Die Behandlung von nicht vorhandenen Datenwerten (also Werte, die
  momentan nicht per NMEA empfangen werden) wurde verändert. In früheren
  Versionen haben verschiedene Anzeigen in diesem Falle "0" angezeigt -
  was aber zu Verwirrungen führen konnte. Das löst [#347](https://github.com/wellenvogel/avnav/issues/347)/[#348](https://github.com/wellenvogel/avnav/issues/348) 
  handling for missing values
* Anzegen (Widgets) mit einem Formatter der einen "unit" Parameter hat,
  können jetzt den dort gewählten Wert direkt als Unit in der Anzeige
  nutzen (wenn man ihn nicht im Layout Editor überschreibt).
* Die Parameter für die Anzeige von Schriften auf der Karte kann man
  jetzt setzen. Es gibt dafür Einstellungen (unter Settings/Map) und beim
  Konfigurieren von [Overlays](hints/overlays.md) kann man
  die Font Parameter ebenfalls setzen.
* Der UDP Reader kann jetzt auch Multicast empfangen.
* AvNav kann die PGNs 129025/129026 direkt von canboat lesen
* Intern gibt es einige Umstrukturierungen - z.B. neue Versionen der
  verwendeten Bibliotheken (reactjs 18) und ein geändertes Handling für
  Dialoge.

***AvNav Android***

* Anpassung an Android 14 (API 34 wie von Google gefordert), veränderte
  Typen des AvNav Service und z.T. veränderte Berechtigungen.
* Verbesserte Startzeit
* Korrekte Funktion von "reset settings". Das löst [#460](https://github.com/wellenvogel/avnav/issues/460):
  Android Settings page

***Fehlerkorrekturen und "Issues" von GitHub***

* [#468](https://github.com/wellenvogel/avnav/issues/468):
  HistoryWidget cannot be selected for a dashboard widget
* [#454](https://github.com/wellenvogel/avnav/issues/454):
  Main Page not displaying correct number of visible/used satellites
* [#462](https://github.com/wellenvogel/avnav/issues/462):
  socket reader transmission rates (0/s) on settings page and log
  mismatching/wrong
* [#461](https://github.com/wellenvogel/avnav/issues/461):
  Can't import KAP charts
* [#460](https://github.com/wellenvogel/avnav/issues/460):
  Android Settings page
* [#457](https://github.com/wellenvogel/avnav/issues/457):
  Copyright date still 2021
* [#456](https://github.com/wellenvogel/avnav/issues/456):
  Browser window stops displaying Target Info
* [#455](https://github.com/wellenvogel/avnav/issues/455):
  invalid local address for wlan-ap2
* [#451](https://github.com/wellenvogel/avnav/issues/451):
  NightChartDim has no effect
* [#447](https://github.com/wellenvogel/avnav/issues/447):
  20250704 AIS: DCPA calculation fails, TCPA Alarm not triggered
* [#445](https://github.com/wellenvogel/avnav/issues/445):
  Track writing stops after time change
* [#433](https://github.com/wellenvogel/avnav/issues/433):
  allow a formatter parameter for leading zeroes in
  formatDirection/formatDirection360
* [#442](https://github.com/wellenvogel/avnav/issues/442):
  avoid react error 310 - different number of hooks
* [#436](https://github.com/wellenvogel/avnav/issues/436):
  allow to change the selected name in upload when already existing
* [#436](https://github.com/wellenvogel/avnav/issues/436):
  correct handling of file names with special characters on android
* [#429](https://github.com/wellenvogel/avnav/issues/429):
  activate overlay changes from mainpage even if not changing the chart
* [#429](https://github.com/wellenvogel/avnav/issues/429):
  show names on Gpx waypoint files
* [#428](https://github.com/wellenvogel/avnav/issues/428):
  show the most important warning in AisNearest widget
* [#427](https://github.com/wellenvogel/avnav/issues/427):
  correctly handle default overlays when editing, avoid useless overlay
  property filtering
* [#426](https://github.com/wellenvogel/avnav/issues/426):
  make loadSettings working again
* [#359](https://github.com/wellenvogel/avnav/issues/359):
  implement cleanCurrentTrack on Android, switch trackdata to new API
  schema, clean current track and rename affected track files
* [#424](https://github.com/wellenvogel/avnav/issues/424):
  show wind speed in WindWidget, correctly handle auto mode for wind
  widgets, move red/green angle to WindGraphics editable parameter
* [#408](https://github.com/wellenvogel/avnav/issues/408):
  App starts every time a usb stick is plugged in
* [#422](https://github.com/wellenvogel/avnav/issues/422):
  use the current target as from when skipping to the next waypoint
* [#358](https://github.com/wellenvogel/avnav/issues/358):
  use wp names from route overlay if inserting into route
* [#358](https://github.com/wellenvogel/avnav/issues/358):
  Overlays: parse routes with own parser, show point names
* [#358](https://github.com/wellenvogel/avnav/issues/358):
  allow to add only the selected point from a route on feature click
* [#337](https://github.com/wellenvogel/avnav/issues/337):
  allow route points renumbering
* [#415](https://github.com/wellenvogel/avnav/issues/415):
  use the system mDns resolver in parallel to the own resolver on Android,
  correctly use a multicast receiver for mDNS resolution
* [#390](https://github.com/wellenvogel/avnav/issues/390):
  add useMinPath to radialGauge
* [#384](https://github.com/wellenvogel/avnav/issues/384):
  add a provider info and a chart name info as css classes to the map
  object
* [#345](https://github.com/wellenvogel/avnav/issues/345):
  add new links for image description
* [#354](https://github.com/wellenvogel/avnav/issues/354)
  from quantenschaum/353-direction-180
* [#400](https://github.com/wellenvogel/avnav/issues/400):
  offsetPress,also add pressure offset to bmp180 and sensehat
* [#345](https://github.com/wellenvogel/avnav/issues/345):
  remove useless doc link for images, add links for bookworm and to pi
  imager
* [#346](https://github.com/wellenvogel/avnav/issues/346):
  add doc for ConfigSequence
* [#394](https://github.com/wellenvogel/avnav/issues/394):
  fix missing aisRelativeMotionVectorRange in settings
* PR [#407](https://github.com/wellenvogel/avnav/issues/407)
  from free-x/lgpio
* PR [#360](https://github.com/wellenvogel/avnav/issues/360)
  from hkapanen/master better descriptions for some settings
* PR [#405](https://github.com/wellenvogel/avnav/issues/405)
  from free-x/pi5-udev - some PI5 changes
* [#406](https://github.com/wellenvogel/avnav/issues/406):
  set ap\_max\_inactivity to 30s
* [#403](https://github.com/wellenvogel/avnav/issues/403):
  fix creating target dirs of converter
* [#404](https://github.com/wellenvogel/avnav/issues/404):
  ignore SK values that do not have a timestamp or a property
* [#403](https://github.com/wellenvogel/avnav/issues/403):
  avoiding deprecation warning
* [#366](https://github.com/wellenvogel/avnav/issues/366):
  avoid map twitching around rotation 0
* [#381](https://github.com/wellenvogel/avnav/issues/381):
  correctly update map widgets when store keys are changing
* [#393](https://github.com/wellenvogel/avnav/issues/393):
  make ais center mode a property
* [#392](https://github.com/wellenvogel/avnav/issues/392):
  correctly set name on dialog button again
* [#387](https://github.com/wellenvogel/avnav/issues/387):
  add missing pointFromMap to Drawing
* [#388](https://github.com/wellenvogel/avnav/issues/388):
  correctly manage the lifecycle of the context for user widgets
* [#377](https://github.com/wellenvogel/avnav/issues/377):
  correctly reset formatter parameters when changin the widget formatter
* [#375](https://github.com/wellenvogel/avnav/issues/375):
  allow to sort AIS list by shipname
* [#381](https://github.com/wellenvogel/avnav/issues/381):
  make triggerRedraw working again
* [#376](https://github.com/wellenvogel/avnav/issues/376):
  make avnav run on python 3.12
* [#373](https://github.com/wellenvogel/avnav/issues/373):
  correctly handle cog/hdg 360
* [#373](https://github.com/wellenvogel/avnav/issues/373):
  handle courses outside of 0...360 for text offsets, use the target
  rotation instead of always COG
* [#371](https://github.com/wellenvogel/avnav/issues/371):
  correctly handle 0 for signalkPitch/signalKRoll
* [#349](https://github.com/wellenvogel/avnav/issues/349):
  use a fixed version for the pip installer on windows
* [#343](https://github.com/wellenvogel/avnav/issues/343):
  doc add NOAA mbtiles hint, reorganize chart sources description

20240616 [link](../downloads/release/20240616 "release/20240616")

***AvNav base***

* [#255](https://github.com/wellenvogel/avnav/issues/255)
  Ermögliche den Start im Split mode  
  [Einstellungen](userdoc/settingspage.md)->Layout->"start
  with last split mode"
* [#263](https://github.com/wellenvogel/avnav/issues/263)
  Ermögliche den direkten Start mit der zuletzt genutzten Karte  
  [Einstellungen](userdoc/settingspage.md)->Map->"start
  with last map"

***AvNav raspberry***

* Unterstützung für bookworm und Pi5
* Starte avnav während der Installation von avnav-raspi nur dann, wenn
  es vorher bereits lief (vermeidet Probleme mit einer Zeitumstellung
  während der Installation)

20240525 [link](../downloads/release/20240525 "release/20240525")

***AvNav base***

***Fehlerkorrektur für 20240520***

* [#342](https://github.com/wellenvogel/avnav/issues/342):
  Fehler beim Aktivieren von Routen

20240520 [link](../downloads/release/20240520 "release/20240520")

Bitte sofort auf 20240525 aktualisieren
- Fehler beim Aktivieren von Routen

***AvNav base***

* neues [Karten import](userdoc/importerpage.md) Handling
  (nicht für Android)

+ Änderung von Namen beim Hochladen
+ Hochladen zip Dateien
+ Herunterladen von umgewandelten Karten (gemf,zip)
+ Status Anzeige, Disable, Neustart
+ [plugin api](hints/plugins.md#PluginAPI) Erweiterung
  für Konverter
+ enthält den S57 Konverter mit [ochartsng](hints/ochartsng.md#chartconversions)

* Neuer [Windows](install.md#Windows) Service und
  Installer  
  **Bitte eine alte Windows Installation entfernen. Diese Version ist
  nicht mehr kompatibel mit dem alten AvNavNet Installer!**
* Separate GUI für Windows/Linux für die Kartenkonvertierung entfernt
  (Konvertierung ist jetzt normaler Bestandteil von AvNav)
* Vereinfachter Start von AvNav von der Kommandozeile, Start ist jetzt
  möglich ohne eine avnav\_server.xml, man kann den HTTP Port auf der
  Kommandozeile setzen.
* Unter Linux kann AvNav jetzt als [user
  service](install.md#userservice) laufen
* besserer Status an den NMEA Verbindungen mit Sende- und Empfangsraten
  sowie Fehlerraten
* [#324](https://github.com/wellenvogel/avnav/issues/324):
  AvNav kann jetzt größere Bursts von NMEA Daten handeln. Die Daten werden
  verworfen, wenn sie zu lange in der internen Queue verweilen.
* Interne Nutzung von "Steady timers" (die sich beim Setzen der Zeit
  nicht ändern) - damit müssen die internen Daten nicht mehr gelöscht
  werden, wenn die Systemzeit geändert wird.
* [#292](https://github.com/wellenvogel/avnav/issues/292):
  Key codes hinzugefügt
* [#303](https://github.com/wellenvogel/avnav/issues/303):
  Rote Icons in der Titel Zeile für [Ankerwache](userdoc/mainpage.md#anchorwatch)
  und [Disconnected Mode](userdoc/mainpage.md#disconnected)
* [#303](https://github.com/wellenvogel/avnav/issues/303):
  Editiermöglichkeit für die [Ankerwache](userdoc/dashboardpage.md#anchorwatch),
  zusätzliche Bestätigung für Ende nötig
* [#327](https://github.com/wellenvogel/avnav/issues/327):
  Optional nur ganzzahlige Zoom Level mit den +/- Buttons
* [#334](https://github.com/wellenvogel/avnav/issues/334):
  Geänderte VMC und HDG Berechnung
* Verhindere das Aussenden von empfangenen Nachrichten auf dem gleichen
  Kanal (Schalter für enable/disable)
* Workaround für fehlerhaftes signalk-to-nmea2000 plugin für [Wegepunkt
  Daten](hints/CanboatAndSignalk.md#waypoint)
* [#325](https://github.com/wellenvogel/avnav/issues/325):
  Zeige relative Bewegungsvektoren für [AIS
  Ziele](userdoc/navpage.md#ais) und einen Indikator für die Drehung
* [#320](https://github.com/wellenvogel/avnav/issues/320):
  Unklare Zuordnung von [SignalK
  zu AvNav](hints/CanboatAndSignalk.md#mapping) entfernt (d.h. keine Fallbacks in der Zuordnung mehr)
* [#333](https://github.com/wellenvogel/avnav/issues/333):
  Weitere [NMEA Dekoder](quickstart.md#decoding)
* [#331](https://github.com/wellenvogel/avnav/issues/331): [Dekodiere magVariation](quickstart.md#decoding)
* [#247](https://github.com/wellenvogel/avnav/issues/247):
  Einige Hilfe-Texte hinzugefügt
* erlaube nutzerdefinierte Icons und Text für geojson Overlays,
  vereinheitlichtes Handling der Style Parameter in Overlays
* [#312](https://github.com/wellenvogel/avnav/issues/312):
  Akzepiere XDR Werte ohne type oder unit.
* [#310](https://github.com/wellenvogel/avnav/issues/310):
  Sende auch vmg zu signalK, Korrektur der SignalK Pfade, os das sie für
  das signalk-to-nmea2000 plugin passen
* [#294](https://github.com/wellenvogel/avnav/issues/294):
  Suchfunktion auf der [Ais Listen Seite](userdoc/aispage.md)
* [#305](https://github.com/wellenvogel/avnav/issues/305):
  Lock Button auf der [Ais Listen Seite](userdoc/aispage.md)
* Bessere Unterbrechung bei langen Hochladevorgängen

kleinere Korrekturen:

* Korrekte AIS Dekodierung von Nachrichten ohne AIS channel ID
* [#332](https://github.com/wellenvogel/avnav/issues/332):
  Korrektur des fehlerhaften blacklist Handlings
* [#321](https://github.com/wellenvogel/avnav/issues/321):
  Vermeide eine ständig wiederholte Nachricht im Log
* [#319](https://github.com/wellenvogel/avnav/issues/319):
  Korrektur des Wegepunkt-Dialogs
* [#318](https://github.com/wellenvogel/avnav/issues/318) 
  Korrektur der BSH Demo-Kartenquelle
* [#313](https://github.com/wellenvogel/avnav/issues/313):
  Korrekte Prüfung von Listen beim Speichern
* [#307](https://github.com/wellenvogel/avnav/issues/307):
  Korrektur eines Fehlers bei canvas gauges mit negativen Werten
* [#301](https://github.com/wellenvogel/avnav/issues/301):
  Richtiges Löschen von Layouts

***AvNav Raspberry (avnav-raspi)***

* [#330](https://github.com/wellenvogel/avnav/issues/330):
  Vorbereitungen für Debian Bookworm (noch nicht final getestet)
* [#297](https://github.com/wellenvogel/avnav/issues/297):
  Unterstützung für den MacArthur HAT

***AvNav Android***

* Hochladen und Herunterladen in der Android App (für plugin Seiten und
  User Apps)app (important for ochartsng)
* Erzwinge IPv4 beim Start des Browsers aus der App (Wichtig für Plugins
  und User Apps)

20230705 [link](../downloads/release/20230705 "release/20230705")

***Alle Versionen - wichtige Fehlerkorrektur:***

* [#288](https://github.com/wellenvogel/avnav/issues/288): Im
  Route-Editor lasse sich keine Punkte mehr hinzufügen

20230702 [link](../downloads/release/20230702 "release/20230702")

Wichtig: Bitte nicht diese Release nutzen,
sondern direkt auf 20230705 gehen.

***Fokus: AvNav Android :***

* Freigabe für Android SDK 33, neu im Play Store (enthält alle
  Änderungen von 20230426)
* Quellen Prioritäten für Input Kanaäle (wie in der Linux Variante)
* [#284](https://github.com/wellenvogel/avnav/issues/284):
  Anzeige der Versions-Information

***AvNav base (avnav) :***

* Verbessertes Handling für das Verschieben der Karte im "course up"
  Modus
* Verbesserte Schrift auf der aisinfo-Seite
* [#283](https://github.com/wellenvogel/avnav/issues/283):
  Korrektes Handling für Button-Verkleinerung bei "2 button columns"
* [#282](https://github.com/wellenvogel/avnav/issues/282):
  Korrektes Handling für das automatische Verbergen der Buttons mit "2
  button columns"
* [#286](https://github.com/wellenvogel/avnav/pull/286):
  Höhere Baudrate. z.B. Moitessier Hat

20230614 [link](../downloads/release/20230614 "release/20230614")

***AvNav Images (avnav-raspi):***

* Verbessertes Handling für Images mit Touch (auch OBP Plotter)

+ Neues Panel auf der Startseite, wenn AvNav nicht komplett startet
  (siehe [Dokumentation](install.md#Touch))
+ Reset für AvNav GUI (firefox Profil)
+ **Wichtiger Hinweis für OBP Plotter**: Bitte auch
  avnav-obp-plotter-v3-plugin mindestens auf 20230601 updaten und nach
  allen Updates neu starten!

* [#274](https://github.com/wellenvogel/avnav/issues/274) 
  update RPI4 (CM) Versionen in uart\_control (GPS auf obp plotter v3)
* Update auf canboat >= 4.12 um einen Fehler im n2kd zu korrigieren
  (neuer Prozess alle 30s, kann alle Systemressourcen verbrauchen)

***AvNav base (avnav):***

* [#272](https://github.com/wellenvogel/avnav/issues/272):
  Verbessertes AIS Handling ([Dokumentation](quickstart.md#AIS))

+ verschiedene Icons je nach navigational status
+ nutze HDG zur Anzeige, wenn verfügbar
+ Anzeige von Atons
+ zeige eine geschätzte aktuelle Position

* [#276](https://github.com/wellenvogel/avnav/issues/276):
  Karte verschieben im Lock Modus([Dokumentation](userdoc/navpage.md))
* [#275](https://github.com/wellenvogel/avnav/issues/275):
  Installation auf bookworm (kein pip im postinstall)
* [#277](https://github.com/wellenvogel/avnav/issues/277):
  requirements für fedora
* Installation auf OpenSuse
* zeige die formatter Parameter im EditWidget Dialog für Widgets mit
  flexiblen Formattern
* ermögliche die Nutzung von online (AIS) streams die nach IEC 62320-1
  arbeiten: Neuer Parameter stripLeading für Reader
* [#279](https://github.com/wellenvogel/avnav/issues/9):Korrigiere
  Zugriffsrechte für den  avnav System Nutzer für serielle/USB Geräte
* Weniger strenge checks für kml Overlays
* Keine Abfrage der Sound-Berechtigung, wenn Sound deaktiviert ist

***AvNav Android:***

* [#273](https://github.com/wellenvogel/avnav/issues/273):
  AIS auf Android für südliche Breiten

20230426 [link](../downloads/release/20230426 "release/20230426")

Unterstützung für dem OpenBoatProjects 10 Zoll Plotter V3 - siehe [Projekt
Dokumentation](https://open-boat-projects.org/de/10-plotter-raspi-4b)   

* Neues Plugin [obp-plotter-v3](https://github.com/wellenvogel/avnav-obp-plotterv3-plugin)
* Unterstützung in avnav.conf und in der [Image
  Vorbereitung](install.md#configBOARDS)

Konfiguration für einige Raspberry Pi HATS

* für AvNav Images können wir jetzt die notwendigen Einstellungen für
  einige HATs automatisch vornehmen.  
  Siehe die Beschreibung bei der [Image
  Vorbereitung](install.md#configHATS).

Erweiterungen in der Plugin API(Server)

* Plugins (auf dem Raspberry Pi) können jetzt [Scripte](hints/plugins.md#scripts)
  haben, um Systemkonfigurationen zu erzeugen basierend auf Einträgen in
  der avnav.conf.
* Neue [API](https://github.com/wellenvogel/avnav/blob/master/server/avnav_api.py)
  Funktionen sendRemoteCommand, registerSettingsFile, registerCommand

Einbettung einiger zusätzlicher Kernel Treiber (Raspberry)  

* ein [neues
  Paket](https://github.com/wellenvogel/avnav-raspi-driver) wird auf AvNav images installiert, das Treiber für RTL8188EU
  und RTL8192EU WLAN Chipsätze enthält.

Kleinere Verbesserungen und Fehlerkorrekturen  
Alle:

* [#249](https://github.com/wellenvogel/avnav/issues/249):
  Nutzung einer Event-Übversetzungsliste um Event-Name für User Widgets
  korrekt durchzureichen.
* [#251](https://github.com/wellenvogel/avnav/issues/251):
  Erlaube das Deaktivieren von Tastenzuordnungen in Nutzer- key.json Datei
* [#252](https://github.com/wellenvogel/avnav/issues/252):
  Korrekte Behandlung von Tastenzuordnungen zu Buttons - auch wenn diese
  momentan nicht sichtbar (oder in der 2. Spalte) sind.
* [#261](https://github.com/wellenvogel/avnav/issues/261):
  Verhindere einen Fehler bei inkonsistenten Daten im store (value und
  dict), Limitiere einzelne logs auf ca. 110MB
* Vermeide Error-Fluten im Log bei Bluetooth Problemen
* Tastenzuordnung z zum Umschalten (Toggle) des Dimm Modus
* Zusätzlicher Button "reload page" auf der Einstellungsseite
* Einige neue [URL Parameter](beschreibung.md#urlParameters)
* Halte die Scrollposition auf der AIS und WPA Seite (Lange Listen von
  AIS-Zielen oder WLAN Netzwerken)

Raspberry:

* [#270](https://github.com/wellenvogel/avnav/issues/270):
  Kein Stop von wpa\_supplicant (Client WLAN) beim Restart von AvNav (z.B.
  vom Updater)
* [#266](https://github.com/wellenvogel/avnav/issues/266):
  Vermeide eine Blockierung beim Setzen der Systemzeit  
  verbesserte Behandlung für das initiale Setzen der Systemzeit ohne GPS,
  korrekte Umschaltung zwischen GPS Zeit und NTP Zeit
* Kein Aufruf des startup-check (Einlesen der avnav.conf) während der
  Installation von avnav-raspi (Verhindert einen reboot während des
  Updates)
* Zusätzliches Template für die avnav\_server.xml in /etc
* Änderung aller WLAN access point Konfigurationen auf "manual" um
  Konflikte mit dem avahi-autoipd zu vermeiden (manchmal kein Korrektes
  Aufsetzen des Access Points)
* Setze restart-ms für alle CAN Interfaces (siehe [Forum](https://www.segeln-forum.de/thread/86708-openmarine-mcarthur-hat/?postID=2508782#post2508782))
  um die Robustheit des NMEA2000 Adapters zu verbessern
* Korrigierte country codes für die Image Vorbereitung
* Entfernen des nicht mehr vorhandenen spi-bcm2835-overlay
* Update der Installationsbeschreibung für Pakete (bullseye)
* Neustart von wlan-av1 bei Änderung der Systemzeit (wpa\_supplicant
  funktioniert potentiell nicht mehr nach Zeit-Umstellungen)
* Korrektur für das Wpa Firewall  Kommand (external access für WLAN
  Netzwerke) , besseres Logging in diesem Teil der Software
* uart\_control Script jetzt in /usr/lib/avnav/raspberry
* korrekte Konfiguration für CANboat (n2kd)

Android:

* einige erste Implementierungen für ein plugin-Handling

20220819 [link](../downloads/release/20220819 "release/20220819")

Split Screen

* Wechsel zu und vom Split Screen per button
* Partiell separate Settings für jeden Tab, Details siehe [Beschreibung](userdoc/mainpage.md#SplitMode)

Verschiedene Routing Modes: RhumbLine, GreatCircle

* default: GreatCircle
* umschaltbar im RoutingHandler
* korrekte Anzeige von great circle Kursen
* [Beschreibung](quickstart.md#RoutingMode)

Verbesserungen

* nicht vorhandene Daten zu Wegepunkt u.ä. werden auf undefined gesetzt
  (Anzeige: ---)
* [#224](https://github.com/wellenvogel/avnav/issues/224):
  AIS Verbesserungen length, beam, draught
* [#213](https://github.com/wellenvogel/avnav/issues/213): [JS API](hints/userjs.md) zum Zeichnen auf die Karte
  (SailSteer Widget)
* Überarbeitung der Bezeichnungen an den Wind Widgets, Wahlmöglichkeit
  der Werte (true, apparent,...)
* [#237](https://github.com/wellenvogel/avnav/issues/237), [#238](https://github.com/wellenvogel/avnav/issues/238):
  Nutzung der ersten kml Datei in kmz Dateien, wenn keine doc.kml
  vorhanden ist
* Bei Overlay Änderungen wird nur das Overlay neu gezeichnet, nicht mehr
  die gesamte Karte
* Scale Parameter jetzt auch für kml und geojson Overlays
* Info Dialog bei geänderter Server-Version
* JS Code (inklusive Widgets) für disabled plugins wird nicht mehr
  geladen
* Default Icon für GPX overlays, Farbe und Größe für Punkte setzbar
* Zeige Zeit, Kurs, Geschwindigkeit beim Klick auf einen Track (Feature
  Info)
* Restart Leg Button (Restart der XTE Berechnung)
* Das JS LatLon Modul wird jetzt am API exportiert
* [#243](https://github.com/wellenvogel/avnav/issues/243), [#217](https://github.com/wellenvogel/avnav/issues/217): Zeige
  remote control Buttons nur, wenn das enabled ist
* [#170](https://github.com/wellenvogel/avnav/issues/170): [Verschiedene Modi der Wegepunkt
  Weiterschaltung](quickstart.md#nextwp): early,90,late

Fehlerkorrekturen

* [#232](https://github.com/wellenvogel/avnav/issues/232):
  korrekte Umrechnung für  AIS SOG in m/s auf Android
* Umwandlung von Tracks in Routen auf der Download-Seite funktioniert
  wieder
* [#222](https://github.com/wellenvogel/avnav/issues/222):
  Neu-Laden der angezeigten Liste auf der Download Seite nach Löschen von
  Elementen
* [#228](https://github.com/wellenvogel/avnav/issues/228):
  $HOST nicht mehr beim Editieren einer User App ersetzen
* [#228](https://github.com/wellenvogel/avnav/issues/228):
  Die Einstellung "new window" wurde bisher nicht über einen AvNav Restart
  hinaus gespeichert
* [#225](https://github.com/wellenvogel/avnav/issues/225):
  Kartenkonvertierung auf Windows geht wieder (gdal2 auf Windows)
* [#223](https://github.com/wellenvogel/avnav/issues/223):
  Korrektes Zusammenführen der storeKeys Einträge aus einer Widget
  Definition und aus den editierbaren Parametern
* [#221](https://github.com/wellenvogel/avnav/issues/221):
  translateFunction funkltioniert jetzt auch für einfache user widgets
* [#219](https://github.com/wellenvogel/avnav/issues/219):
  Vermeidung von fortlaufenden Log Nachrichten der SignalK Time Verbindung
* [#220](https://github.com/wellenvogel/avnav/issues/220):
  Vermeidung einer Endlosschleife im NMEA Dekoder bei fehlerhaften XDR
  Sätzen
* Ersatz des Paketes gir1.2-appindicator3-0.1 durch
  gir1.2-ayatanaappindicator3-0.1 für die Touch Screen Einrichtung
* Korrekte Auslieferung der default user.js
* Android: Track wurde beim Beenden der App geleert
* Richtige Berechnung der Annäherung and einen Wegepunkt in der App
* [#231](https://github.com/wellenvogel/avnav/issues/231):
  Track GPX OpenCPN Kompatibilität
* [#244](https://github.com/wellenvogel/avnav/issues/244):
  falsche XTE Richtung

20220421 [link](../downloads/release/20220421 "release/20220421")

Starke Erweiterung der SignalK Integration

* AvNav kann jetzt direkt seine Navigationsdaten (inklusive AIS) von
  SignalK empfangen
* Wegepunkt-Daten können an SignalK geschickt werden
* Alarme können zu SignalK geschickt und von dort empfangen werden
* Das SignalK Handling wurde von einem Plugin in den "core" verlagert
* Für Details siehe die [Beschreibung](hints/CanboatAndSignalk.md#SignalK)

Images mit Touch Support

* Die AvNav Images haben jetzt auch Support für einen lokalen Monitor
  (Schwerpunkt: Touch)
* Das ersetzt die nicht mehr gepflegten AvNav-Touch images.
* Details in der [Installationsbeschreibung](install.md)

Setzen der Systemzeit ohne GPS

* die AvNav Images haben jetzt ein fallback-Handling zum Setzen der
  Systemzeit
* wenn für eine gewisse Zeit kein GPS Signal empfangen wird, wird
  versucht über NTP die Zeit zu ermitteln
* das sollte Probleme beim Internet Zugriff vermeiden (SignalK,
  mapproxy,...)

Weitere neue Funkionen

* Trennung von true und apparent Wind in den internen Daten - die
  Anzeige der Wind-Widgets kann jetzt fest einem von beiden zugeordnet
  werden
* Beim Parsen von RMC wird jetzt korrekt geprüft, ob Kurs und
  Geschwindigkeit vorhanden sind
* [#169](https://github.com/wellenvogel/avnav/issues/169):
  Anzeige für Map Scale (in den Settings unter Layer)
* [#87](https://github.com/wellenvogel/avnav/issues/87):
  Alarm und rote Titelzeite, wenn die Verbindung zum Server abbricht
* [#206](https://github.com/wellenvogel/avnav/issues/206):
  Setzen von Ankerwache mit Keyboard Kommandos
* [#200](https://github.com/wellenvogel/avnav/issues/200):
  Verschiedene Boot-Symbole für COG und HDM/HDT sowie Stillstand, bessere
  Berechnung des Kurs-Mittelwertes
* [#202](https://github.com/wellenvogel/avnav/issues/202):
  Parsen von ZDA
* [#188](https://github.com/wellenvogel/avnav/issues/188):
  Umschalten/Ausschalten des Remote Channels direkt auf Navigations- und
  Dashboard Seiten
* Pitch und Roll für BME280, skPitch,skRoll Widgets können auch Input in
  deg verarbeiten
* Kleinere interne Korrekturen

Fehlerkorrekturen

* korrekte Mittelwertbildung für Kurs-Werte
* besseres Fehlerhandling bei avahi
* restart button manchmal nicht sichtbar auf der Status-Seite
* android: Korrektes Arbeiten der overlay-change-detection
* [#212](https://github.com/wellenvogel/avnav/issues/212):
  Speed Gauge: Setzen von maxValue < 10 führt zum crash
* Karten-Konvertierung auch unter bullseye (GDAL3)

Migrationshinweis

* falls nicht besondere Alarm-Kommandos definiert wurden, sollten
  Einträge für den AVNAlarmHandler aus der avnav\_server.xml entfernt
  werden.  
  Dann können die Alarm-Sounds über die Settings-Seite eingestellt werden
  und es können eigene Alarm-Sounds genutzt werden.

20220306 [link](../downloads/release/20220306 "release/20220306")

* Fehlerkorrektur [#196](https://github.com/wellenvogel/avnav/issues/196):
  Android AvNav empfängt keine Positionsdaten wenn es im Hintergrund ist
* Fehlerkorrektur [#195](https://github.com/wellenvogel/avnav/issues/195):
  Beim Laden von Settings mit einem anderen Layout als system.default beim
  initialen Dialog wird das Layout nicht geladen
* Kleinere interne Korrekturen

20220227 [link](../downloads/release/20220227 "release/20220227")

**Nur Windows !**

* Fehler in 20220225 korrigiert, der den Server Start verhindert

20220225 [link](../downloads/release/20220225 "release/20220225")

Speichern und Laden von Einstellungen

* Die Einstellungen auf einem Gerät können auf dem Server gespeichert
  und auf diesem oder anderen Geräten wieder geladen werden.
* Das [plugin interface](hints/plugins.md) wurde
  erweitert um settings in einem Plugin mitzubringen und zu registrieren.
* Beim erstmaligen Start von AvNav auf einem Gerät wird eine Auswahl
  der gespeicherten Einstellungsdateien angezeigt, falls es mehr ale eine
  gibt. Der Nutzer kann entscheiden, welche er nutzen möchte. Später
  können andere Dateien über die [Einstellungsseite](userdoc/settingspage.md)
  geladen werden.
* Auf der [Einstellungsseite](userdoc/settingspage.md)
  werden geänderte Werte durch unterschiedliche Schriftstile dargestellt.
* Die Möglichkeit Einstellungen innerhalb einer Layoutdatei zu
  speichern, wurde entfernt (man kann aber umgekehrt in einer
  Settings-Datei auch den Namen des zu nutzenden Layouts angeben)

AIS Verbesserungen

* [#185](https://github.com/wellenvogel/avnav/issues/185):
  zeige sowohl AIS Ziele im eingestellen Umkreis um die Bootsposition als
  auch um den Kartenmittelpunkt.
* [#187](https://github.com/wellenvogel/avnav/issues/187):
  In den Einstellungen kann gewählt werden, welche AIS Ziele angezeigt
  werden sollen (class A, class B,other).
* Optimierung der Anzeige-Performance in der AIS Liste
* Die pro Ziel in der AIS Liste angezeigten Informationen können
  reduziert werden
* Class B Ziele können in der Karte kleiner angezeigt werden
* Das momentan "verfolgte" AIS Ziel wird in einer separaten Farbe
  dargestellt.
* Das Verfolgen beginnt durch Klick auf den Center button {{BT("WpLocate")}} auf der AIS Seite.
* [#149](https://github.com/wellenvogel/avnav/issues/149):
  Die Werte, die bei einem AIS Ziel angezeigt werden, können ausgewählt
  werden (bis zu 3)
* [#145](https://github.com/wellenvogel/avnav/issues/145):
  AIS Ziele, die in Ruhe sind, können verborgen werden.

Andere neue Funktionen:

* [#135](https://github.com/wellenvogel/avnav/issues/135):
  Entfernungen können durch das Setzen einer Markierung auf der
  Kartenmitte (button {{BT("Measure")}}) gemessen werden. Die Entfernung und der Kurs zur
  Kartenmitte werden im "Center Display Widget" und neben der Kartenmitte
  angezeigt.
* Der Dialog für das Bearbeiten einer Route wurde klarer gestaltet
* [#141](https://github.com/wellenvogel/avnav/issues/141):
  Mehr Möglichkeiten für das Aktivieren der Ankerwache. Man kann die
  aktuelle Position oder die Kartenmitte als Ankerposition nutzen sowie
  einen Offset angeben. Siehe die [Beschreibung](userdoc/dashboardpage.md#anchorwatch).
* Wenn eine neue TCP Verbindung zu AvNav erfolgt, werden NMEA Daten nur
  ab dem aktuellen Zeitpunkt gesendet (vorher wurden bis zu 10 ältere
  Sätze gesendet).
* [#146](https://github.com/wellenvogel/avnav/issues/146):
  Die Karten auf der Hauptseite sind alphabetisch sortiert. Ausserdem
  wurde die Dialogabfrage "center map now" entfernt.
* [#148](https://github.com/wellenvogel/avnav/issues/148):
  AvNav erkennt automatisch, wenn sich Overlays ändern und zeichnet die
  Karte neu. Das gilt auch für Routen.
* [#151](https://github.com/wellenvogel/avnav/issues/151):
   [UserApps](userdoc/addonconfigpage.md) können jetzt in
  einem eigenen Browser-Fenster/einem eigenen Tab geöffnet werden. Das
  geht allerdings nur für externe URLs.
* [#155](https://github.com/wellenvogel/avnav/issues/155):
  USB Monitoring, Bluetooth reader und NMEA logger können über die
  Server/Status Seite ausgeschaltet werden.
* [#160](https://github.com/wellenvogel/avnav/issues/160):
  Dekodierung der Wasser-Temperatur von MTW und der Geschwindigkeit durchs
  Wasser von  VHW. Zusätzliche widgets für STW und water temp
* [#163](https://github.com/wellenvogel/avnav/issues/163):
  Sie Socket Reader können jetzt auch NMEA Daten senden
* AvNav kann jetzt auch gestartet werden, wenn auf dem System kein
  python-bluez verfügbar ist. (Ein enstprechender Status wird angezeigt)
* Unter Android wird jetzt auch APB gesendet
* Dekoder für VWR NMEA0183
* [#164](https://github.com/wellenvogel/avnav/issues/164)
  Höhere Bauraten als 115200
* [#180](https://github.com/wellenvogel/avnav/issues/180):
  Android: Es wird eine Warnung ausgegeben, wenn die Android Power Savee
  Einstellungen das GPS im Hintergrund abschalten, da dann keine
  Track-Aufzeichnung oder das Aussenden von NMEA Daten erfolgen kann.
* Es gibt 2 neue Widgets für SignalK Daten: skpitch/skroll (danke an
  Tom)
* Die Seiten-Navigation zwischen der AIS-Liste und der AIS Detail-Seite
  wurde verbessert (Hin- und Zurücknavigation möglich)

Änderungen für den Server Start:

* Das logfile enthält jetzt auch alle potentiellen Fehler beim Start
* Man kann beim Aufruf von der Kommandozeile jetzt den log level
  mitgebenlogging
* Im Normalfall wird mit dem Log Level "error" gestartet (Option -q)

Fehlerkorrekturem:

* [#192](https://github.com/wellenvogel/avnav/issues/192),
  [#193](https://github.com/wellenvogel/avnav/issues/193):
  korrektes Übergeben der Parameter für Formatierer
* [#191](https://github.com/wellenvogel/avnav/issues/191):
  Entfernung der nihct genutzten "caption" für das Combined Widget
* [#190](https://github.com/wellenvogel/avnav/issues/190):
  Hinzufügen der erforderlichen minValue/maxValue für radialGauge
* [#189](https://github.com/wellenvogel/avnav/issues/189):
  Korrektur in canvas gauges
* Anpassung der Grössen für  wind widget und depth widget
* [#186](https://github.com/wellenvogel/avnav/issues/186):
  Verhinderung eines sporadischen crashes
* [#184](https://github.com/wellenvogel/avnav/issues/184):
  Richtiges Handling für store keys (value) und Formatter Parameter im
  Layout Editor
* registrierte Layouts und settings werden entfern wenn ein Plugin
  disabled wird
* [#182](https://github.com/wellenvogel/avnav/issues/182):
  Korrektes Handling für default Formatter Parameter
* Dokumentation korrigiert für nutzerdefinierte Formatter
* Verhinderung von mehrfacher USer App Registrierung durch plugins
* Erhalt der eingestellten Farben beim Editieren von Overlaysnumber
* [#161](https://github.com/wellenvogel/avnav/issues/161):
  Rückfall handling bei nicht ladbaren Konfigurationen
* [#178](https://github.com/wellenvogel/avnav/issues/178):
  Die "translate" ist jetzt für alle Widgets verfügbar
* Korrektur des erzeugten APB Satzes
* [#157](https://github.com/wellenvogel/avnav/issues/157):
  Weiterschaltung zum nächsten Wegepunkt einer Route, wenn kein Client
  verbunden ist
* [#154](https://github.com/wellenvogel/avnav/issues/154):
  Update für die Dokumentation der Installation mit Paketen
* [#150](https://github.com/wellenvogel/avnav/issues/150):
  Dokumentation: Direkter Link zu mbtiles von OpenSeaMap
* [#153](https://github.com/wellenvogel/avnav/issues/153):
  Overlay Dialog für Mobilgeräte korrigiert
* [#152](https://github.com/wellenvogel/avnav/issues/152):
  Löschen von Routen auf Android funktioniert wieder
* Korrektur für den Konverter wenn utf-8 in KAP Dateien vorhanden ist
* Android: Verhinderung eines Absturzes, falls kein Dateimanager
  installiert ist
* [#143](https://github.com/wellenvogel/avnav/issues/143):
  Korrektes Herunterfahren des Servers aus der App heraus

Interne Änderungen:

* Build Werkzeuge und Bibliotheken auf aktuelle Stände gebracht
* Explizite definition der nodejs Version (16) beim Bauen per gradle
* Optimierung des Builds für die Web-App

20210619 [link](../downloads/release/20210619 "release/20210619")(Android Version: 20210618)

Neue Funktionen

* zeige den Nachtmodus Button auch im Layout Editor
* [#88](https://github.com/wellenvogel/avnav/issues/88):
  dekodiere HDG,HDT,HDM,VHW (teilweise) auf dem Server und unter 
  Android
* HDT,HDM widgets
* ermögliche die Nutzung von HDT oder HDM für die Richtungsanzeige des
  Boot-Symbols ([Einstellungen](userdoc/settingspage.md)/navigation/boat
  direction )
* [#138](https://github.com/wellenvogel/avnav/issues/138)
  ermögliche das Boot auf jeder beliebigen Position auf dem Bildschirm zu
  fixieren([Einstellungen](userdoc/settingspage.md)/map/lock
  boat mode)
* [#139](https://github.com/wellenvogel/avnav/issues/139)
  zeige den Nachtmodus Button auch auf der Navigationsseite
* Erlaube einen "schwebenden" Mode der Buttons und Anzeigen über der
  Karte ([Einstellungen](userdoc/settingspage.md)/map/float
  map behind buttons)
* Verberge die Buttons auf der Navigationsseite und auf den Dashboard
  Seiten nach einer einstellbaren Zeit ([Einstellungen](userdoc/settingspage.md)/buttons/auto
  hide buttons...)
* [#132](https://github.com/wellenvogel/avnav/issues/132)
  zeige +/- 180 im Wind Widget (einstellbar im Layout Editor), kleinere
  Verbesserungen am Wind Graphics Widget
* setze den Layout-Namen als CSS Klasse an der Applikation um [CSS
  Stile](hints/usercss.md) für verschiedene Layouts zu ermöglichen
* [Fernsteuerung](hints/RemoteControl.md)

+ Steuere ein Display von einem anderen oder vom Server
+ 5 Kanäle, jedes Display kann auf einem davon senden oder/und
  empfangen
+ UDP Port für den Empfang von Fernsteuerkommandos
+ [Plugin](https://github.com/wellenvogel/avnav-obp-rc-remote-plugin)
  für die Zusammenarbeit mit der obp-rc-remote Fernbedienung

* Interface Wichtungen für eine einfache Umschaltung zwischen ethernet
  und WLAN für den Internet-Zugang (avnav-raspi)

  Fehlerkorrekturen:

* Einfrieren bei der Nutzung von Linear Gauges
* Falsche Button-Sortierung auf alten Browsern
* [#140](https://github.com/wellenvogel/avnav/issues/140):
  Nachtmodus für XTE Widget, Wind Graphics, einige Gauges
* Umschaltung zwischen Access Point und WLAN client über die Config GUI
  funktionierte nicht
* Wenn gleichzeitig apparent und true Wind vorhanden sind, springt die
  Anzeige zwischen beiden. Jetzt wird "apparent" bevorzugt und nur wenn
  das nicht empfangen wird, wird "true" genutzt. Es erfolgt eine Anzeige
  welcher Wert genutzt wird.
* Korrektur das Filter Handlings für Komma separierte Filter am Plugin
  API
* Korrektur des read filter Handling am SocketWriter

20210502 [link](../downloads/release/20210502 "release/20210502")

Neue Funktionen

* Erweiterung der [Konfiguration](../configGen/index.md)
  für die Headless Images (Hostname, Tastatur, Umschaltung der WLAN
  Nutzung)
* Bessere Verbindung zu anderen WLAN Netzen (IP Adresse wird schneller
  ermittelt)

Fehlerkorrekturen:

* Korrekte Anzeige der Button Icons im Lite Mode vom Chrome auf Android
  ([#128](https://github.com/wellenvogel/avnav/issues/128))
* einige MCS Module für one wire wurden nicht korrekt geladen (nur für
  headless images)
* Die Auflösung für NMEA0183 services erfolgte nur einmal (jetzt korrekt
  permanent wiederholt im Fehlerfall)



20210424 [link](../downloads/release/20210424 "release/20210424")

Focus: [Android App](android/android.md)

* Die Android App hat jetzt einen kompletten NMEA0183 Multiplexer - so
  wie die Server Variante
* Damit kann man:

+ verschiedene TCP/UDP NMEA0183 Datenquellen anschliessen
+ NMEA zu TCP/UDP Zielen senden
+ Mehrere USB-Seriell-Wandler nutzen um NMEA Daten zu senden und zu
  empfangen
+ NMEA Daten per Bluetooth senden und empfangen
+ Die Daten des eigenen GPS aussenden
+ Den Multiplexer im Hintergrund laufen lassen und die Daten für
  anderen Navigations-Apps bereitstellen
+ Mdns (Bonjour/Ahavi) nutzen um leicht eine Verbindung zu NMEA
  Datenquellen herzustellen - auch in sich verändernden Netzwerken
+ Eigene NMEA Ausgänge per MDNS für andere Apps oder Systeme bekannt
  machen
+ Die NMEA Daten einkommend und ausgehend mit Filter-Ausdrücken und
  Blacklisten einschränken
+ Ein NMEA Log in eine Datei schreiben.
+ Den Status aller Verbindungen auf der Status/Server Seite anzeigen

* Android integriert jetzt den Webserver in den "normalen" Modus (wurde
  vorher "external browser mode" genannt)

+ Der Zugriff kann vom gleichen Gerät oder von anderen Geräten per
  Browser erfolgen
+ Der default Port für den Webserver ist jetzt 8080

* Erzeugung von RMB Datensätzen, wenn ein Routing aktiv ist (kann
  ausgesendet werden, um z.B. einen Autopiloten zu steuern)
* Die Konfiguration der Android App ist jetzt weitgehend identisch zur
  Server Version und erfolgt auf der Status/Server Seite

+ HINWEIS: einige Konfigurationen werden von einer älteren Version
  übernommen - jedoch nicht alle

Für die Raspberry Version (Headless Image):

* Unterstützung von USB Tethering von einem Android Gerät. Damit kann
  man den Raspberry über das angeschlossene Gerät ins Internet bringen -
  oder auch die Verbindung zum AvNav Server über USB herstellen (einfach,
  wenn man unter Android den BonjourBrowser nutzt)

Für alle Server Versionen (Headless Image, OpenPlotter,...):

* Bekanntmachen von TCP NMEA Ausgängen (AVNSocketWriter) per Avahi
  (mdns/Bonjour) - andere AvNav server oder die Android App können sich so
  einfach verbinden.
* AVNNmea0183ServiceReader zur Verbindung mit einem Avahi (mdns/Bonjour)
  NMEA Service (wie z.B. SignalK)
* Erweiterung im [plugin API](hints/userjs.md) - die
  initFunction erhält nun auch die WidgetParameter beim Aufruf

Fehler Korrekturen:

* #123: bluetooth Verbindungsabbrüche
* Anpassungen an neuere gdal Versionen für den Importer
* Files immer mit utf-8 encoding zum Lesen oder Schreiben öffnen (Chart
  Konverter)
* CSS Anpassung für bessere Kompatibilität mit alten Browsern
* Mehr Robustheit gegen NMEA Nachrichten mit leeren Elementen
* Manchmal wird im Layout Editor auch ein anderes Widget mit geändert,
  wenn man ein kopiertes Widget ändert

20210323 [link](../downloads/release/20210323 "release/20210323")

Fehlerkorrekturen für 20210322  

* Windows: AvNav startet nicht nach update
* Windows: SocketWriter lässt sich nicht umkonfigurieren
* [#119](https://github.com/wellenvogel/avnav/issues/119):
  Crash in der App bei linear Gauges
* [#120](https://github.com/wellenvogel/avnav/issues/120):
  Crash in der App wenn ein Formatter nicht (mehr) existiert
* Defaultwerte für Widgets werden im Layout-Editor nicht richtig gesetzt
  (z.B. Farben bei Gauges)
* Crash in der App bei Date/Time formattern wenn keine oder falsche
  Daten vorhanden sind

neuer Windows Installer  



20210322 [link](../downloads/release/20210322 "release/20210322")

Die größte Änderung ist die Möglichkeit, die Konfiguration des Servers
direkt in AvNav zu ändern (z.B. das Hinzufügen neuer Interfaces). Das
erfordert auch ein Update für alle plugins auf ihre neuesten Versionen.

AvNav Core:  

* Man kann jetzt die Konfiguration direkt in AvNav ändern ([Server/Status
  Seite](userdoc/statuspage.md)), die Änderungen werden ohne Restart sofort wirksam
* Wenn man Karten mit leeren zoom layern nutzt (viele mbtiles Dateien)
  ist AvNav jetzt in der Lage geringer aufgelöste Kacheln vergrößert
  anzuzeigen. Das vermeidet leere Bereiche auf der Karte in bestimmten
  Zoomstufen.
* Man kann die Kartendarstellung jetzt skalieren(Settings/Map). Das kann
  die Sichtbarkeit auf hochauflösenden Displays verbessern.
* Es gibt eine experimentelle Vorschau auf einen split creen Modus,
  erreichbar mit http://address:port/viewer/viewer\_split.html, siehe [demo](../viewern/viewer_split.md?navurl=../viewer/avnav_navi.php&amp;readOnlyServer=true)
* Die Anpassung der Symbolgrössen an hochauflösende Displays sollte
  jetzt korrekt sein.
* Direkte Registrierung von AvNav bei MDNS (Bonjour), man kann den Namen
  anpassen, der registriert wird.
* Erweiterungen im [plugin API](hints/plugins.md)

Raspberry Pi (Images)

* Unterstützung für den [MCS
  von GeDad](https://www.gedad.de/projekte/projekte-f%C3%BCr-privat/gedad-marine-control-server/), siehe [Image Beschreibung](install.md)
* [Anpassung der Images](install.md) vor der Benutzung mit
  einer Konfigurationsdatei und einer Web-Oberfläche für die Erzeugung
* Sowohl AvNav als auch SignalK sind jetzt per MDNS/Bonjour sichtbar
* Bessere WLAN Stabilität durch Abschaltung des power save managements
* Automatisches Aufsetzen einer IP Adresse am Ethernet Interface wenn
  keine Verbidnung zu einem DHCP Server besteht
* Weiterleitung von Port 80 zu AvNav (8080), erspart die Eingabe von
  :8080 in den URLs

Kleinere Fehlerkorrekturen (engl.)

* handle utf-8 in download names correctly
* keep status on status page until we get server error, correctly show
  and hide server error
* increase network timeout
* work around strange height bug on ios 12,13 safari
* always use shutdown when closing sockets, re-enable timeout for socket
  reader
* #113: merge pr, correctly handle null values in SK
* #117: prevent browser 2 finger zoom
* restart avahi when changing the system time
* avoid hiding second buttons on status page
* decrease default font sizes
* create an error gemf for failed conversions, add importer log display
  on download page, timeout importer status items
* allow opensuse install
* show plugin info in status if startup fails
* restart server
* log display
* server download log
* cleanup name handling and thread id for logging
* better timeout handling for serial (avoid reopen after 1s)
* rename AVNGpsdFeeder to AVNFeeder, completely remove gpsd related code
* #106: avoid writing errors to the log if empty positions lead to
  decode errors
* merge #105
* adapt to new handling of com port names on windows
* correct windows download links

20210115 [link](../downloads/release/20210115 "release/20210115")

* [#73](https://github.com/wellenvogel/avnav/issues/73):
  Umstellung des Servers auf python3 (das bisherige python2.7 wird nicht
  mehr gepflegt)
* [Plugin API](hints/userjs.md) Java Script Erweiterung für
  [featureFormatter](hints/overlays.md#adaptation)
* Dekodierung von XDR Datensätzen
* Formatter für Druck und Temperatur
* Erweiterung des Java Script API - [Registrierung
  von Formattern](hints/userjs.md#formatter)
* besseres Handling für formatterParameters im [Layout
  Editor](hints/layouts.md)
* [NMEA filter](hints/configfile.md#filter) für
  AVNSocketReader,AVNBluetoothReader und AVNUdpReader
* das [avnav
  history plugin](https://github.com/wellenvogel/avnav-history-plugin) ist in den Paketquellen enthalten und kann mit
  ```
  sudo apt-get install avnav-history-plugin
  ```
  installiert werden.
* Fehlerkorrekturen:

+ [#97](https://github.com/wellenvogel/avnav/issues/97):
  NMEA Prüfsummen mit kleinen Buchstaben
+ Korrektes Handling des Dimmfaktors für die Karte im Nachtmodus

* **Installationshinweise**:  
  Bei der Installation mit Paketen (apt) müssen neue Abhängigkeiten
  installiert werden.
  ```
  sudo apt-get update  
  sudo apt-get upgrade
  ```
  Bei den headless Paketen muss vorher die Zeit gesetzt werden.
  ```
  sudo date -s "2021/01/15 15:00"
  ```
  Es ist wichtig, dass auch vom [ocharts-plugin](hints/ocharts.md)
  die aktuelle Version 20210115 installiert wird.  
  Bei der Windows Installation sollte ein neuer [Installer](../downloads/release/20210115)
  genutzt werden.   
  Falls mit dem vorhandenen Installer ein Update ausgeführt wird, muss es
  2 mal nacheinander durchgeführt werden, da beim ersten Mal die neue
  Python Version nicht installiert wird.

20201227 [link](../downloads/release/20201227 "release/20201227")

* [Plugin API](hints/plugins.md) Erweiterung für USB Geräte
* Fehlerkorrekturen

+ **RMB funktionierte nicht in den letzten Versionen, repariert**
+ kleinere Fehler im widget handling für plugins
+ kleinere Fehler bei den angezeigten Buttons
+ einige verbesserte Logs am Server

20201226 [link](../downloads/release/20201226 "release/20201226")

* Fullscreen Button  
  Falls vom verwendeten Browser unterstützt, gibt es auf der Hauptseite,
  Navigationsseite und auf den Dashboard Seiten   
  einen {{BT("FullScreen")}}Button,
  um Fullscreen ein- und auszuschalten
* Separate Einstellungs-Kategorie für Buttons
* Fehlerkorrekturen

+ OSM online Karten
+ bessere Kompatibilität für ältere Browser
+ Android Dim Handling

20201219 [link](../downloads/release/20201219 "release/20201219")

* [Karten Overlays](hints/overlays.md)

+ Man kann  gpx,kml,kmz und geojson Dateien über die Karten legen
+ Mehrere Karten übereinander legen
+ Anzeige von vorhandenen Tracks und Routen
+ Nutzerdefinierte Symbole und links mit HTML Seiten
+ Anzeige von Informationen zu einem Punkt beim Klick

* [Anzeige von
  Objekt-Informationen](hints/ocharts.md#featureinfo) (Feature Query) bei o-charts (erfordert neue
  [avnav-ocharts Version](hints/ocharts.md#Releases))
* Erweiterungen beim Track Handling

+ Anzeige von Informationen (Länge, Zeit, Geschwindigkeit)
+ [#67](https://github.com/wellenvogel/avnav/issues/67):
  Anzeige von Tracks auf der Karte (als Overlay)
+ [Konvertierung](hints/TracksToRoutes.md) von Tracks zu
  Routen
+ Import von gpx Tracks

* Verbesserungen im Routen Handling

+ [Neuer Dialog](userdoc/editroutepage.md#routedialog)
  für Umbenennen, Leeren, Kopieren, Löschen
+ Verbinden von Routen
+ [#9](https://github.com/wellenvogel/avnav/issues/9) Nutze
  einen Wegepunkt aus einer Gpx Datei zum Hinzufügen zu Routen
+ Routen können jetzt auch "rückwärts" gebaut werden ("insert before")

* Verbessertes Fehlerhandling

+ Zeige einen Fehlerdialog mit der Möglichkeit den Fehler zu speichern
+ Anzeige von Fehlern in der user.js

* Erweiterungen in den Settings

+ "increase fonts on hires" - Vergrößerung verschiedener
  Anzeige-Elemente bei hochauflösenden Displays
+ "Overlay Info on Click" - Anzeige von Overlay Informationen wenn man
  auf die Karte klickt (default: ein)  
  das steuert auch die Anzeige von Objekt-Informationen bei o-charts
+ "Always Info on Chart Click" - Anzeige einer Information in
  Bereichen ohne Overlays (default: aus)

* Verbesserte Dokumentation

+ [Tastaturunterstützung](hints/keyboard.md) beschrieben
+ [Index](docmap.md)

* [#79](https://github.com/wellenvogel/avnav/issues/79):
  Aufrufparameter noCloseDialog um die Abfrage beim Verlassen der Seite zu
  verhindern
* Fehlerkorrekturen:

+ Zurückspringen zur Startseite nach Klick auf ein AIS symbol
+ "cancelTop" funktioniert jetzt auch unter firefox
+ Korrektes Senden von MTA NMEA Sätzen ($ am Anfang fehlte)

20201202 [link](../downloads/release/20201202 "release/20201202")

Fehlerkorrekturversion für 20201105

* Bug: Die SignalK Verbindung mit WebSockets (neu in 20201105)
  funktioniert nicht komplett. Nicht geänderte Daten verschwinden nach
  30s. Man konnte auch die Nutzung von WebSockets nicht abschalten
* Bug: In der Dokumentation war für signalK useWebsockets falsch
  angegeben

20201105 [link](../downloads/release/20201105 "release/20201105")

* Feature: Button für Power Save (Android und BonjourBrowser) [#69](https://github.com/wellenvogel/avnav/issues/69)
* Feature: Geschwindigkeitsabhängige Kurs-Vektoren für eigenes Boot und
  AIS [#59](https://github.com/wellenvogel/avnav/issues/59),
  siehe [Navigationsseite](userdoc/navpage.md) (dazu einige
  neue Einstellungen)
* Feature: Einstellungen für die AIS Symbolgröße und einen Rand [#58](https://github.com/wellenvogel/avnav/issues/58)
* Feature: Eigene Symbole für das Boot und AIS Ziele (unterschiedlich
  pro Typ) [#53](https://github.com/wellenvogel/avnav/issues/53),
  siehe [Beschreibung](hints/usericons.md)
* Feature: Overflow Button wenn mehr als 8 Buttons nicht passen,
  Möglichkeit für 2. Button Spalte [#68](https://github.com/wellenvogel/avnav/issues/68),
  siehe [Navigationsseite](userdoc/navpage.md)
* Feature: Einstellmöglichkeit um den Zurück-Button immer ganz oben zu
  haben
* Feature: Package Abhängigkeit zu gpsd entfernt
* Feature: Möglichkeit für Plugin Widgets mit dem Server zu
  kommunizieren (event handler) [#75](https://github.com/wellenvogel/avnav/issues/75),
  siehe [Plugin Beschreibung](hints/plugins.md) und [User
  Java Script](hints/userjs.md)
* Feature: Nutzung von Karten, die unter [SignalK
  installiert](https://github.com/SignalK/charts-plugin) sind [#76](https://github.com/wellenvogel/avnav/issues/76),
  siehe [SignalK
  Karten](hints/CanboatAndSignalk.md#SignalKCharts)
* Bug: N2K (canboat) arbeitet weiter, auch wenn lange keine Daten
  vorhanden sind
* Bug: Unerwarteter Wechsel von einer Seite zur anderen (doppeltes Klick
  Handling in Listen)
* Bug: Gehe im Routen Editor zum vorletzten Punkt, wenn der letzte
  gelöscht wird
* Bug: Robusteres Dekodieren von teilweise leeren DPT und DBT Sätzen [#60](https://github.com/wellenvogel/avnav/issues/60)
* Bug: korrekte Behandlung von Filtern in avnav\_server.xml die nur eine
  Blacklist enthalten
* Bug: Robustere Behandlung von verkürzten Class 5 AIS Nachrichten
  (keine Namen, Callsign,...)
* Bug: Neuladen einer Karte im Browser, wenn sie auf dem Server
  modifiziert wurde (mbtiles, ocharts)
* Bug: (Android) akzeptiere unbekannte NMEA talker ids
* Bug: Center to Ais target funktioniert nicht [#74](https://github.com/wellenvogel/avnav/issues/74)
* Bug: Richtige Anzeige der anchor watch distance in m [#62](https://github.com/wellenvogel/avnav/issues/62)
* Bug: Darstellung kaputt für lange URL in User App Dialog [#66](https://github.com/wellenvogel/avnav/issues/66)
* Bug: Korrektur für das Handling des Schemas bei mbtiles (xyz,tms) [#63](https://github.com/wellenvogel/avnav/issues/63), siehe [Beschreibung Karten](charts.md)
* **Hinweis**: Nach Installation per Hand mit dpkg (erzeugt einen
  Fehler) müssen ggf mit
  ```
  sudo apt-get install -f
  ```
  die neuen Abhängigkeiten nachinstalliert werden.

20200609 [link](../downloads/release/20200609 "release/20200609")

* korrektes Handling von Karten mit Leerzeichen im Namen
* Android Korrekturen (Version 20200605) - korrekter external Browser
  mode in älteren Android Versionen

20200515 [link](../downloads/release/20200515 "release/20200515")

* GPS Status Anzeige auf der Hauptseite (Danke free-x)
* Wind Grafik auf der Nav Seite wird nicht mehr kleiner
* Tiefenanzeige funktioniert wieder
* CSS Klasse für Widgets im Layout Editor funktioniert
* NMEA logger funktioniert wieder richtig
* Kein mehrfaches Laden von Plugins mehr
* eniro aus den Demo Sourcen entfernt

20200401 [link](../downloads/release/20200401 "release/20200401")

* Verbindung mit freien externen WLANs funktioniert wieder

20200325 [link](../downloads/release/20200325 "release/20200325")

* [Layout Editor](hints/layouts.md) zur Anpassung des
  Layouts an eigene Vorstellungen
* Karten im [mbtiles Format](charts.md)
* Einbindung von [grafischen
  Anzeigen](userdoc/dashboardpage.md) (mittels [canvas-gauges](https://canvas-gauges.com/))
* Verwalten von [Nutzerdateien](userdoc/downloadpage.md#userfiles)
  und "[user apps](userdoc/addonconfigpage.md)" um eigene Web
  Seiten einzubinden
* Erweiterung und Anpassung von AvNav mit [java
  script](hints/userjs.md) und [css](hints/usercss.md)
* Überarbeitete Dokumentation (auch in Englisch)

20200204 [link](../downloads/release/20200204 "release/20200204")

* Support für NME2000 (via canboat) und SignalK - siehe [Beschreibung](hints/CanboatAndSignalk.md)
* Anpassungen am Layout

20200126 [link](../downloads/release/20200126 "release/20200126")

* Fehlerkorrektur Android ständiger Notification-Ton
* Fehlerkorrektur Routen-Länge auf der Detail-Seite.
* MOB Handling. Bei Klick auf die MOB Taste wird ein aktuelles Routing
  abgebrochen, die aktuelle Position wird als Wegepunkt "MOB" gesetzt und
  es wird ein Alarm ausgelöst. Die MOB Taste bekommt einen roten Rand.
  Beendet wird das MOB über die MOB Taste oder über das Stoppen der
  Navigation.  
  Wenn in avnav\_config.xml ein AlarmHandler konfiguriert wurde, benötigt
  diese Funktion einen neuen Eintrag dort.   
  Wenn nur die Standard-Sounds für die Alarme verwendet werden sollen,
  kann der gesamte AVNAlarmHandler Eintrag entfernt werden.  
  ```
  <AVNAlarmHandler>
  <Alarm name="waypoint" command="sound" parameter="$BASEDIR/../sounds/waypointAlarm.mp3" repeat="1"/>
  <Alarm name="ais" command="sound" parameter="$BASEDIR/../sounds/aisAlarm.mp3" repeat="1"/>
  <Alarm name="anchor" command="sound" parameter="$BASEDIR/../sounds/anchorAlarm.mp3" repeat="20000"/>
  <Alarm name="gps" command="sound" parameter="$BASEDIR/../sounds/anchorAlarm.mp3" repeat="20000"/>
  <Alarm name="mob" command="sound" parameter="$BASEDIR/../sounds/anchorAlarm.mp3" repeat="2"/>
  </AVNAlarmHandler>
  ```

20191224 [link](../downloads/release/20191224 "release/20191224")

* Größerer interner Umbau
* Keyboard Support. Die aktuellen Bindings findet man auf [GitHub](https://github.com/wellenvogel/avnav/blob/master/viewer/static/keys.json).
  Eine Anpassung ist im Layout über einen parameter "keys" möglich. Siehe
  [Beispiel
  auf GitHub](https://github.com/wellenvogel/avnav/blob/master/viewer/layout/testPlugin1.json). Eine detaillierte Beschreibung folgt. Auch unter
  Android.
* Einführung von Layouts: Man kann über eine Json Datei die Widgets auf
  der Navigationsseite und auf den Dashboard Seiten anpassen. Dazu unter
  Settings->Layout eine andere Layout-Datei wählen. Zum ändern die
  vorhandene system.default Datei herunterladen (Download Seite),
  Anpassen, ggf. umbenennen und wieder hochladen. Eine detaillierte
  Beschreibung folgt.  
  Das ist auch unter Android möglich.
* Anpassung des Aussehens per css. Über eine Datei
  /home/pi/avnav/data/user/viewer/user.css können eigene css-Regeln
  eingebracht werden. Das ist auch unter Android möglich.
* Anpassen  des Verhaltens über eigene Widgets. Mit einer Datei
  /home/pi/avnav/user/viewer/user.js können eigene Widgets definiert und
  später im Layout genutzt werden. Ein [Beispiel
  findet sich auf GitHub](https://github.com/wellenvogel/avnav/blob/master/server/plugins/testPlugin/plugin.js). Das ist auch unter Android möglich.
* Plugin Konzept. Mit Python code und Js-Code kann avnav jetzt erweitert
  werden. Mit den Python Anteilen können z.B. weitere NMEA Sätze dekodiert
  werden, NMEA Daten gelesen und geschrieben werden oder auch Daten in den
  internen Speicher (und damit zur Anzeige) geschickt werden. [Ein
  Beispiel ist auf GitHub](https://github.com/wellenvogel/avnav/tree/master/server/plugins/testPlugin) vorhanden. Eine detaillierte Beschreibung
  folgt. Nicht unter Android.

20190429 [link](../downloads/release/20190429 "release/20190429")

* Im neuesten Raspbian gibt es Fehler, die verhindern das bei bestimmten
  REALTEK basierten WLAN-Adaptern ein Neu-Verbinden mit einem Netz
  funktioniert. Es betrifft Adapter die das Kernel Module 8192cu nutzen.
  Man sieht im log dann Fehler dieser Art:  
  ```
  wlan-av1: Association request to the driver failed
  ```
  Als Workaround habe ich eine Überwachung eingebaut, die wenn dieser
  Fehler ein paar mal auftritt, das Kernel module neu lädt. Damit arbeitet
  der WLAN Zugang zu externen Netzen wieder. Es kommt nur beim
  Neu-Verbinden immer zu einer kurzzeitigen Nicht-Verfügbarkeit des WLANs
  - sieht man im Status. Schwierig wird es nur dann, wenn man mehrere
  WLAN-Module mit diesem Chipsatz verwendet und eines davon auch als
  access point. Hier würde das WLAN auch kurzzeitig unterbrochen - Mobile
  Geräte verbinden sich dann gerne mal mit einem anderen. Solange man den
  Access Point ( default ) über das interne WLAN abwickelt, hat man keine
  Probleme. Da es nur ein workaround ist, wird der nicht standarmäßig
  aktiviert - nach der Installation des Updates muss man noch den
  entsprechenden service aktivieren und starten:  
  ```
  sudo systemctl enable avnav-check-wlan
  sudo systemctl start avnav-check-wlan
  ```
  Ich hoffe, das es irgendwann eine Korrektur gibt, die den workaround
  wieder überflüssig macht.
* Standardmässig ist der Zugang von aussen (Web-Oberfläche oder
  ssh)  über das wlan-av1 (d.h. den WLAN Adapter, der eine Verbindung
  nach draussen macht) gesperrt, damit aus einem öffentlichen WLAN niemand
  auf den raspberry zugreifen kann. Für manche Szenarien wäre es aber
  wünschenswert, wenn man das kann. Ich habe z.B. einen mobilen Hotspot
  und möchte den raspi gerne mit diesem verbinden. Wenn dann bei mir
  Geräte direkt mit dem Hotspot verbunden sind (und nicht mit dem avnav
  WLAN) möchte ich trotzdem auf den raspi zugreifen können. Daher gibt es
  jetzt eine Möglichkeit, diesen Zugriff von aussen pro WLAN zu gestatten.
  Man sollte hier sorfältig sein, und das auf keinen Fall in einem
  öffentlichen WLAN (z.B. Hafen) zulassen!  
  Um die Funktion zu ermöglichen, muss nach der Installation ein Eintrag
  in der avnav\_server.xml vorgenommen werden:  
  ```
  <AVNWpaHandler>
   firewallCommand="sudo -n $BASEDIR/../raspberry/iptables-ext.sh wlan-av1"
  wpaSocket="/var/run/wpa_supplicant/wlan-av1">
  </AVNWpaHandler>
  ```
  Wenn dieser Eintrag vorhanden ist (danach neu starten), wird bei WLANs,
  die für diesen Zugriff freigeschaltet sind, "ext access" angezeigt, beim
  Verbinden kann das ausgewählt werden.  
  Im Status für das Interface wird ebenfalls angezeigt, ob der externe
  Zugriff erlaubt ist und ob das firewallCommand erfolgreich war. Wenn es
  nicht erfolgreich war, sollte der raspi neu gestartet werden, damit die
  firewall wieder korrekt funktioniert.

20190415 [link](..downloads/avnav-raspi-20190415.zip)

* Neues Image basierend auf 2019-04-08-raspbian-stretch-lite
* Support für Raspi3b+
* Alle Korrekturen bis 2019/04/15 (Udp Writer thx to BlackSea)
* ahavi config für avnav (mit Bonjour-Browser zu finden)

+ für IOS [Bounjour
  Search](https://itunes.apple.com/us/app/bonjour-search-for-http-web-in-wi-fi/id1097517829?mt=8)
+ für Android [Bonjour
  Browser](https://play.google.com/store/apps/details?id=de.wellenvogel.bonjourbrowser)

* Möglichkeit in der Start-Page andere URLs einzubinden
* Größerer interner Umbau - Plugin-Interface (Doku folgt...)
* Dieses Image ist das letzte direkt von mir bereitgestellte Image -
  neuere finden sich wie unter [Installation](install.md)
  beschrieben.

20180313 [link](../downloads/release/20180313)

* Ausschalten aller Alarme mittels Taster an GPIO Pin. Dazu muss in der
  avnav\_server.xml für den AlarmHandler ein Attribut stopAlarmPin
  angegeben werden. Beispiel:  
  ```
  <AVNAlarmHandler stopAlarmPin="7">
  ```

  Die
  Pin Nummer ist dabei die Nummer am Pi connector - siehe [howto](http://raspberrypiguide.de/howtos/raspberry-pi-gpio-how-to/)- im Beispiel Pin 7 = GPIO4.  
  Zum Ausschalten der Alarme muss dieser Pin mit Masse verbunden werden
  (einfacher Taster).

Korrekturen:

* Konverter für die Karten auf dem Pi funktioniert wieder mit dem
  neuesten Image (neue gdal Version)

20180306 [link](../downloads/release/20180306)

Korrekturen:  

* gps Alarm aktiv
* korrektes Icon für Android "add to homescreen"

20180218 [link](../downloads/release/20180218)

kleinere Fehlerkorrekturen zu 20180215

* Status auf Hauptseite vertauscht für NMEA/AIS
* Versions-Info auf Hauptseite falsch
* kleinere Android Korrekturen

20180215 [link](../downloads/release/20180215)  
  
Anker Alarm  
Achtung: Dazu muss die avnav\_server.xml erweitert werden. (Wenn man neu
aufsetzt, wird das automatisch erzeugt, dann muss man nichts tun).  
Am Ende bitte einfügen:  
  
```
<AVNCommandHandler >
    <Command name="shutdown" command="sudo shutdown -P"/>
    <Command name="sound" command="/bin/sh $BASEDIR/../raspberry/sound.sh 90%" repeat="1"/>  
</AVNCommandHandler>
<AVNAlarmHandler>
    <Alarm name="waypoint" command="sound" parameter="$BASEDIR/../sounds/waypointAlarm.mp3" repeat="1"/>  
     <Alarm name="anchor" command="sound" parameter="$BASEDIR/../sounds/anchorAlarm.mp3" repeat="20000"/>  
 <Alarm name="gps" command="sound" parameter="$BASEDIR/../sounds/anchorAlarm.mp3" repeat="20000"/>
</AVNAlarmHandler>
```
Das Kommando, das den Alarm-Sound ausgibt, kann frei angepasst werden
("sound" command oder ein anderes) - man kann auch z.B. ein gpio Pin
schalten.   
Falls man ein anderes Kommando nutzen möchte (z.B. eigenes Shell-Script)
muss man das als neues Kommando unter AVNCommandHandler eintragen, ihm einen
Namen geben und dann bei den Alarmen diesen neuen Namen nutzen.  
Man kann natürlich auch das oben angegebene "sound" Kommando durch etwas
anderes ersetzen.  
Der unter "Alarm" angegebene Parameter wird an das entsprechende Kommando
weitergereicht.  
In jedem Falls sollte eine Alarm-Ausgabe am pi direkt vorgesehen werden, es
kann ja sein, das gerade kein Tablet an ist.   
Wenn beim Alarm als Parameter eine sound-Datei angegeben ist, kann der sound
(zusätzlich) auch auf dem Tablet erzeugt werden (dort in den settings
prüfen, ob er eingeschaltet ist).  
  
Fehlerkorrekturen/Verbesserungen:  

* <https://github.com/wellenvogel/avnav/issues/27>
* <https://github.com/wellenvogel/avnav/issues/30>
* SenseHat Support <https://github.com/wellenvogel/avnav/pull/31>
* besseres Handling von mehreren WLAN interfaces
* support für BMP180,BME820 (Danke Oleg!)
* <https://github.com/wellenvogel/avnav/issues/33>
* erlaube Verbindungen zu offenen WLANs (kein Passwort)
* router output jetzt auch APB (nicht nur RMB)
* navipack Konverter (Danke Oleg!)
* Datenschutzerklärung
* NMEA checksum error <https://github.com/wellenvogel/avnav/pull/37>
  (Danke Oleg!)
* workaround für IOS Geräte (keine Anzeige der AIS-Seite)
* Layout tuning

  
  
20170410 [link](../downloads/release/20170410)  
Fehlerkorrekturen:  

* track display
* route handling wenn nicht verbunden
* erhalte wlan config files bei updates
* #29: Radius der Kreise
* modus ohne gpsd funktioniert wieder
* korrekte Ermittlung der Layer-Grenzen für gemf Karten
* Android Korrekturen