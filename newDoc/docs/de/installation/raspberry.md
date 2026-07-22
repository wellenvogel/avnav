---
  tags:
    - Raspberry
    - Installation
    - Images
---
# Raspberry PI

Für den Rapsberry Pi steht AvNav in verschiedenen Varianten bereit:

* [Fertige Images](#images)
* [Pakete](#packages)
* [OpenPlotter](#openplotter)

## Images

Ab Version 20220421 unterstützen die Images sowohl den sogenannten
"headless" Betrieb - d.h. es ist weder Tastatur noch Monitor am Pi
angeschlossen, als auch einen Betrieb mit einem angeschlossenen (Touch-)
Bildschirm (gerne auch optional Tastatur und Maus).

AvNav ist von der Bedienung für Touch-Geräte optimiert - aber man kann es
natürlich auch mit Bildschirm, Tastatur und Maus bedienen.

Wie man die Images nutzt, hängt also vom Anwendungsfall ab. Im "headless"
Betrieb wird der Raspberry nur als Server eingesetzt, die Anzeige erfolgt
dann z.B. auf Mobilgeräten. Für diesen Fall reicht ein Raspberry Pi 3B(+).
Wenn ein Monitor und Peripherie wie Tastatur und Maus direkt an den
Raspberry angeschlossen werden, sollte man einen Pi4 oder Pi5 mit
mindestens 2GB Speicher wählen.

Diese Images werden von [BlackSea](https://www.segeln-forum.de/cms/user/27970-blacksea/)
gepflegt (vielen Dank...). Diese werden mit pi-gen gebaut und enthalten
AvNav, SignalK und weitere Software. Eine Beschreibung findet sich im [Repository](https://github.com/free-x/AvNav-Image).

Unter Windows/Linux/OSx lädt man das Image [von
free-x](https://github.com/free-x/AvNav-Image) herunter und transferiert es z.B. mit dem [raspi-imager](https://www.raspberrypi.com/software/) 
auf eine SD Karte.  
Beim Imager dazu unter "CHOOSE OS" "Use Custom" auswählen und die img
Datei selektieren. Keine "customizations" wählen.

Diese Images enthalten

* avnav
* avnav-raspi-base
* avnav-raspi-network
* [avnav-update-plugin](https://github.com/wellenvogel/avnav-update-plugin)
* [avnav-ocharts-plugin](hints/ocharts.md)
* [avnav-mapproxy-plugin](https://github.com/wellenvogel/avnav-mapproxy-plugin)
* [avnav-history-plugin](https://github.com/wellenvogel/avnav-history-plugin)
* [SignalK](hints/CanboatAndSignalk.md)
* [Canboat](hints/CanboatAndSignalk.md)
* Support for [MCS](https://www.gedad.de/projekte/projekte-f%C3%BCr-privat/gedad-marine-control-server/)
* optional einen X-Server mit openbox und firefox im Kiosk Modus
* Unterstützung für verschiedene [HATs](#configHATS)

Die Images sind so vorkonfiguriert, dass NMEA0183-Daten von allen Interfaces
zu AvNav und von dort zu [SignalK](hints/CanboatAndSignalk.md)
geleitet werden. AvNav holt sich zusätzlich alle Daten von SignalK und kann
diese anzeigen. Für Details zur SignalK-Integration siehe die [Beschreibung](hints/CanboatAndSignalk.md#SignalK).  
NMEA2000-Daten laufen über Canboat zu SignalK und zu AvNav.  
Für Details zu Canboat siehe [CanBoatAndSignalK](hints/CanboatAndSignalk.md).

### Image Vorbereitung {: #preparation}

neu ab Version "20210322", erweitert ab Version "20220421"

Bevor die fertig vorbereitete SD-Karte im Raspberry verwendet wird,
sollte man einige Einstellungen anpassen. Das gilt vor allem für
Passwörter:  
Die Images haben eine Konfigurationsdatei "avnav.conf". Sie findet sich in
der ersten Partition der SD-Karte (Boot-Partition). Diese Datei kann mit
einem Texteditor angepasst werden.  
Dort kann auch eingestellt werden, ob ein lokaler Bildschirm genutzt
werden soll ("Touch Variante")

Einfacher geht es mit einer kleinen Web-Oberfläche [hier](../configGen/index.md).

[![](img/ConfigImagesUi.png)](../configGen/index.md)

Die Bedeutung der Felder:

|  |  |  |
| --- | --- | --- |
| Name | Default | Beschreibung |
| ConfigSequence | 1 | Wenn man erreichen möchte, dass die Einstellungen aus avnav.conf noch einmal neu im System aktiviert werden sollen, kann man diesen Wert erhöhen. AvNav merkt sich sonst, welche Einstellungen bereits aufgesetzt wurden, und setzt diese nicht erneut. |
| Wifi SSID | avnav | Der Name des WLAN-Netzwerks, das der Raspberry erzeugen soll. Die Images sind so vorbereitet, dass man durch Einstecken von WLAN-Adaptern auch weitere Netzwerke erzeugen kann. Daher wird eine einstellige Nummer an den Namen angefügt. |
| Wifi Password | avnav-secret | Das Passwort für das WLAN-Netzwerk. Das sollte in jedem Falle geändert werden. Jeder, der sich mit dem WLAN verbinden kann, kann damit auch die Navigation beeinflussen! |
| User pi password | raspberry | Das ist das Passwort für den Nutzer "pi". Dieser Standard- User wird genutzt, wenn man sich per SSH verbindet oder wenn man direkt per Monitor und Tastatur auf den Raspberry zugreift. Das Passwort für den User "pi" sollte ebenfalls unbedingt geändert werden. |
| Base Board | None | Hier kann man aus unterstützten Basis-Platinen wählen.   * **MCS:** Wenn diese Option aktiviert ist, wird beim   nächsten Bootvorgang die notwendige Software für den [Marine   Control Server von GeDad](https://www.gedad.de/projekte/projekte-f%C3%BCr-privat/gedad-marine-control-server/) aktiviert. Die Änderung der   Einstellung führt dann zu einem automatischen Reboot, wenn der   Raspberry das erste Mal mit dieser Einstellung startet. * **OBPPLOTTERV3:** Hiermit werden die Einstellungen für den   [Open   Boat Projects Plotter (V3)](https://open-boat-projects.org/de/10-plotter-raspi-4b) gesetzt. |
| HAT {: #configHATS } | None | Hier kann man einen unterstützten Pi-HAT auswählen. AvNav wird die entsprechenden Einträge für die Overlays in /boot/config.txt machen und die CAN Netzwerk-Schnittstellen anlegen.   * WAVESHAREB: [Waveshare   RS485 CAN HAT (B)](https://www.waveshare.com/wiki/RS485_CAN_HAT_%28B%29) * WAVESHAREA8: [Waveshare   RS485 CAN HAT (8Mhz)](https://www.waveshare.com/wiki/RS485_CAN_HAT) * WAVESHAREA12: [Waveshare   RS485 CAN HAT (12 Mhz)](https://www.waveshare.com/wiki/RS485_CAN_HAT) * WAVESHARE2CH: [Waveshare   2CH CAN HAT](https://www.waveshare.com/wiki/2-CH_CAN_HAT) * PICANM: [PICAN-M](https://cdn.shopify.com/s/files/1/0563/2029/5107/files/pican-m_UGB_20.pdf?v=1619008196) * MCARTHUR: [MacArthur   HAT](https://github.com/OpenMarine/MacArthur-HAT) |
| Module RTL8188EU | aus | Wenn eingeschaltet, wird der [Kernel-Treiber](https://github.com/lwfinger/rtl8188eu/tree/v5.2.2.4) für WLAN-Adapter mit dem Chipsatz RTL8188EU per [DKMS](https://dyn.manpages.debian.org/unstable/dkms/dkms.8.en.html) eingerichtet.  Wenn der Kernel des Systems aktualisiert wird (Kommandozeile), wird der Treiber neu übersetzt.  Bisher nicht für Bookworm-Images (oder neuere) verfügbar, da es diese Treiber nicht gibt. |
| Module RTL8192EU | aus | Wenn eingeschaltet, wird der [Kernel Treiber](https://github.com/Mange/rtl8192eu-linux-driver) für WLAN-Adapter mit dem Chipsatz RTL8192EU per [DKMS](https://dyn.manpages.debian.org/unstable/dkms/dkms.8.en.html) eingerichtet.  Wenn der Kernel des Systems aktualisiert wird (Kommandozeile), wird der Treiber neu übersetzt.  Bisher nicht für Bookworm-Images om/wiki/RS485
(oder neuere) verfügbar, da es diese Treiber nicht gibt. |
| TimeZone | Europe/Berlin | Die Zeitzone, die im Image genutzt werden soll. |
| WifiCountry | Germany | Das Land (muss für den Wifi Adapter aus rechtlichen Gründen gesetzt werden) |
| InternalWifi as Client | aus | Wenn eingeschaltet, wird der interne Wifi Adapter des Pi nicht als Access Point definiert, sondern kann sich mit anderen Netzwerken verbinden.  Achtung: Das erfordert eine andere Möglichkeit, um auf den Pi zugreifen zu können - siehe [[Verbinden mit dem Raspberry](../special/connecting-pi.md)]. |
| KeyboardLayout | German | Layout für eine angeschlossene Tastatur (Kommandozeile und X) |
| KeyboardType | Generic 105-key PC(intl.) | Typ der angeschlossenen Tastatur |
| TouchSupport  (ab 20220421) | aus | Wenn eingeschaltet, startet ein X-Server mit einem Firefox Browser im Kiosk Modus. Über einen Button in AvNav kann auf einen anderen "Bildschirm" gewechselt werden, über den File Manager, Terminal u.ä. verfügbar sind. |
| Display DPI  (ab 20220421) | 96 | Nur für den lokalen Bilschirm.  Die Auflösung in dots/inch für das angeschlossene Display. Beim Klick öffnet sich ein kleiner Rechner, in dem die Abmessungen des Bildschirmes in mm und Pixel angegeben werden können, daraus wird der DPI-Wert berechnet.  Basierend auf diesem Wert werden einige Anzeige-Elemente skaliert. |
| OnScreen KeyboardHeight  (ab 20220421) | 7 | Die Höhe einer Tastenzeile beim angezeigten OnScreen Keyboard. Bei korrekter DPI-Einstellung sollte dieser Wert ein guter Kompromiss sein.  Wenn man den Wert sehr groß wählt, bleibt u.U. bei angezeigter Tastatur nicht mehr genug Bildschirmfläche... |
| HideCursor  (ab 20220421) | an | Verbergen des Cursors auf dem lokalen Bildschirm. Wenn mit einer Maus gearbeitet werden soll, muss dieser Schalter auf "aus" gesetzt werden. |

Nach dem Eintragen der Werte kann man durch Klick auf den
"download"-Button die "avnav.conf"-Datei herunterladen. Diese muss in die
erste Partition der SD-Karte gespeichert werden. Eine eventuell dort
vorhandene Beispieldatei muss überschrieben werden! Diese Partition muss
dazu natürlich auf dem Computer sichtbar sein. Unter Windows wird man in
der Regel nur die erste Partition sehen können. Eventuell muss man dazu
nach dem Schreiben des Images die SD-Karte noch einmal enfernen und wieder
einstecken.

Es empfiehlt sich daher, die "avnav.conf"-Date noch einmal an einem
sicheren Platz zu speichern, um sie ggf. beim Erzeugen einer neuen
SD-Karte wiederverwenden zu können.

Nun kann man die SD-Karte in den Raspberry stecken und ihn starten. Der
erste Boot kann einige Zeit dauern, da das gesamte Dateisystem auf der
SD-Karte erzeugt werden muss. Je nach den Einstellungen in der
Konfiguration wird der Raspberry noch ein weiteres Mal neu starten.

Wenn der Raspberry seine Systemeinrichtung endgültig abgeschlossen hat,
kann man sich mit ihm [verbinden](../special/connecting-pi.md).

### Lokaler Bildschirm

Wenn man in der [Vorbereitung](#preparation) die Bildschirm-Unterstützung eingeschaltet wurde, startet ein service
"avnav-startx". Dieser erzeugt einen lokalen X Server, eine Nutzer-Sitzung
für den Nutzer pi mit [openbox](https://openbox.org/help/Contents)
als Fenster-Manager und Firefox im Kiosk Mode.

Als Bildschirm-Tastatur (On Screen Keyboard) wird [onboard](http://manpages.ubuntu.com/manpages/bionic/man1/onboard.1.html)
verwendet.

Auf der AvNav-Hauptseite (und auf einigen anderen Seiten) wird ein
"Raspberry" Button angezeigt, mit diesem wechselt man auf einen zweiten
virtuellen Bildschirm, auf dem man einen Dateimanager, ein Terminal und
verschiedene weitere Tools findet.  
Das System ist ganz bewusst nicht als ein komplettes Desktop-System
ausgelegt, um möglichst ressourcenschonend zu arbeiten.

Da man an die Systemtools nur über den Button in der AvNav App
herankommt, ist es sinnvoll, sich einen weiteren Zugang zum Pi wie weiter
oben beschrieben zuzulegen.  
Damit kann man im Fehlerfall auf das System zugreifen.  
Ein Restart der Nutzeroberfläche von der Kommandozeile kann mit

```
sudo systemctl restart avnav-startx
```

erfolgen.  
Falls Firefox einmal nicht mehr richtig starten möchte, kann man das
Nutzerprofil entfernen. Das wird beim nächsten Start automatisch neu
angelegt.  
**Achtung**: AvNav-Einstellungen, die nicht auf dem Server gespeichert
wurden, gehen dabei verloren.

```
sudo systemctl stop avnav-startx  
rm -rf /home/pi/.mozilla/firefox/avnav  
sudo systemctl start avnav-startx
```

Ab Version 20230614 wird auf dem Hauptbildschirm immer dann, wen AvNav
nicht (oder nicht komplett) aktiv ist, ein zusätzliches Panel angezeigt.

![](../img/xui-ffpanel.png){: data-gallery=g1 }

Über dieses Panel können einige Navigationsfunktionen in Firefox
gesteuert werden, es kann zum 2. Bildschirm (system) gewechselt werden -
und man kann die (oben beschriebene) Reset-Funktion für das
Firefox-Nutzerprofil ausführen (![](../img/SailBoatRed96.png){ .inline-image}).

Damit ist eine Bedienung des Systems auch möglich, wenn AvNav wider
Erwarten nicht komplett startet. Die Reset-Funktion findet sich auch auf
dem System-Bildschirm (allerdings nur für komplette Neu-Installationen).
 
### Repositories

Auf den AvNav Images sind Debian Repositories vorkonfiguriert, die alle nötigen Pakete enthalten. Siehe dazu unter [Paket Installation](#packages).
Diese Repositories werden auch vom [AvNav Updater](https://github.com/wellenvogel/avnav-update-plugin) benutzt. 


## Pakete { #packages}

Falls man nicht die AvNav Images oder OpenPlotter auf dem Raspberry Pi nutzen möchte, kann man auch AvNav als Paket auf einem Debian oder Ubuntu System installieren. 
Dazu kann man den Installationsanleitungen für [Linux Pakete](linux.md#packages) folgen.
Es sollte in diesem Fall nur das avnav-Paket installiert werden, keines der avnav-raspi Pakete.

Auf AvNav Images sollten Updates über den AvNav Updater erfolgen. Für Reparaturzwecke oder für die Installation von Beta-Versionen kann jedoch auch die Paket-Installation genutzt werden.

Es sind die folgenden AvNav Grundpakete installiert:

* avnav - AvNav Basispaket
* avnav-raspi-base - AvNav Image spezifische Funktionen für AvNav (ab debian trixie)
* avnav-raspi-network - Konfiguration des Netzwerkes mit dem [NetworkManager](https://networkmanager.dev/) (ab debian trixie)

## OpenPlotter

Wenn man ein komplettes Desktop-System mit vielen weiteren Anwendungen
haben möchte, kann die OpenPlotter-Variante
eine gute Basis sein. Dafür empfiehlt sich ein Pi4 oder Pi5 mit 4GB
Speicher. Auch 2GB Arbeitsspeicher wird ausreichen - dann bleibt aber
nicht viel Raum für zukünftige Anforderungen.

Für [OpenPlotter](https://openmarine.net/openplotter) gibt es
eine komplette Integration von AvNav (Dank an [e-sailing](https://github.com/e-sailing)).
Im Repository <https://www.free-x.de/deb4op/>
, das bereits standardmäßig mit OpenPlotter 2 (und 3) kommt, sind die
notwendigen Pakete bereits vorhanden. Somit kann man sie einfach
installieren:

```
sudo apt update
sudo apt install openplotter-avnav
```

Seit 2021/03 ist AvNav offiziell in OpenPlotter verfügbar. So sollte nach
einem Update von OpenPlotter "openplotter-avnav" bereits verfügbar sein.

Die Pakete "avnav-raspi....deb" sollte man auf OpenPlotter nicht
installieren, weil es sich nicht mit den Netzwerkeinstellungen von
OpenPlotter verträgt. Innerhalb der OpenPlotter-AvNav-Konfiguration kann
man den HTTP-Port für AvNav ändern, wenn es Probleme mit anderen Apps
geben sollte. Die Defaultwerte sind: :8080 für den Browserzugriff, :8082
für ocharts.

Wenn man AvNav mit der OpenPlotter-App installiert, empfängt AvNav alle
NMEA-Daten von SignalK und sucht nicht selbst nach USB-Geräten. Alle
Geräte-Konfigurationen oder Schnittstellen-Einrichtungen können so direkt
in OpenPlotter und SignalK vorgenommen werden.
