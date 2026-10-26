---
  tags:
    - Verbindungen
    - Netzwerk
    - Raspberry
    - Wifi
---
# Raspberry Pi Netzwerkverbindungen

Wenn man einen Raspberry Pi mit einem [AvNav Image](../installation/raspberry.md#images) gestartet hat, werden auch die Netzwerkverbindungen für den Raspberry Pi über AvNav-Funktionen gesteuert.

Das betrifft vor allem die Verbindung von den Anzeige-Geräten (Webbrowser) zum Raspberry Pi - aber auch die Möglichkeiten, den Raspberry Pi mit dem Internet oder einem Bord-(IP)-Netzwerk zu verbinden.

Neben dem Zugang per Webbrowser sind die Images auch für einen Zugang per Kommandozeile (SSH) vorbereitet. Im Normalfall wird dieser nicht benötigt, da sich alle wichtigen Funktionen direkt aus AvNav heraus steuern lassen.

Aber für die Fehlerbehebung oder auch für weitergehende Eingriffe oder Umstellungen am System ist es sehr nützlich, einen solchen Zugang zum System zu haben.

Wenn das Image für einen lokalen Bildschirm konfiguriert wurde, kann man
direkt mit einem angeschlossenen Bildschirm und ggf. noch mit Tastatur
und Maus arbeiten.

Allerdings sollte man auch diesem Falle eine der hier im Folgenden beschriebenen Verbindungen vorbereiten - man kann sie eventuell in Fehlersituationen gut gebrauchen.

## Verbinden mit dem Raspberry Pi

Prinzipiell kann man sich auf mehrere Arten mit dem Raspberry verbinden:

1. per Ethernet-Kabel  
   Das geht entweder durch Anschluss an einen Router oder Switch oder
   über eine einfache Verbindung z.B. direkt zu einem Laptop.
2. per internem WLAN  
   Standardmässig macht der Pi einen Access-Point mit der in der
   Konfiguration gewählten SSID auf. Er hängt dort jeweils noch eine Nummer
   an. Falls man weitere WLAN-Adapter anschließt, kann man auch mehrere
   Access Points erzeugen.
3. per USB von einem Android Gerät  
   Moderne Android-Geräte haben meist eine "USB-Tethering" Funktion, über
   die man das WLAN oder die Mobilfunk-Verbindung per USB weitergeben kann.
   Das gilt leider meist nur für Geräte mit Mobilfunk.   
   Über diesen Weg kann man sich auch mit dem Pi verbinden.
4. Über ein anderes WLAN.  
   Das erfordert aber zunächst eine der anderen Verbindungsmöglichkeiten,
   da man die Zugangsdaten einstellen muss. Außerdem erfordert es einen
   zusätzlichen WLAN-Adapter.

### Verbindung per Ethernet-Kabel

Wenn man den Pi mit einem Router verbindet (z.B. im Heimnetz), dann
erhält er von diesem eine IP-Adresse. Über diese Adresse kann man sich mit
dem Pi verbinden.  
Da es oft mühsam ist, diese Adresse herauszufinden, macht sich der Pi im
Netz per [mDNS](https://en.wikipedia.org/wiki/Multicast_DNS)
(Bonjour, Avahi) bekannt.  
Auf diese Weise kann man sich z.B. mit einem Browser einfach zu AvNav
verbinden:

```
http://xxxx.local:8080
```

xxx ist dabei der in der [Image-Konfiguration](../installation/raspberry.md#preparation) gewählte Hostname.  
Auch ein Zugang per SSH (unter Windows z.B. per [putty](https://www.chiark.greenend.org.uk/%7Esgtatham/putty/))
íst auf diese Weise möglich - das Zugangs-Passwort für den Nutzer "pi" wurde
bereits in der Image-Konfiguration gesetzt.

Falls man sich mit einem Netzwerkkabel direkt z.B. mit einem Laptop
verbindet, wird der Pi nach einiger Zeit selbständig eine IP-Adresse
aufsetzen. Das kann 1...2 Minuten dauern. Diese gehört zum sogenannten
"Automatic Private IP Addressing"-Bereich 169.254.x.x. Die meisten Desktop
Systeme unterstützen das ebenfalls. Unter Linux muss man es ggf. explizit
einschalten.   
Wenn also der Laptop auch auf seinem Ethernet Interface eine solche
Adresse aufgesetzt hat, sollte eine Verbindung wie beschrieben per
xxxx.local funktionieren.

Falls der Zugriff über die xxx.local Adresse nicht funktionieren sollte,
muss man versuchen, die IP-Adresse des Pi zu ermitteln, z.B. über die
Administration des heimischen Routers oder eine passende App.

### Verbindung über das eingebaute WLAN {: #connect-wifi}

Man kann das WLAN-Netzwerk verwenden, das der Raspberry erzeugt hat. Die
SSID und das Passwort wurden wie bei der [Image-Konfiguration](../installation/raspberry.md#preparation) beschrieben in der Datei "avnav.conf" definiert (mit noch einer angehängten Nummer).

Auch hier steht man vor dem Problem, zunächst die IP-Adresse des Pi
herausfinden zu müssen. Wie schon beim Ethernet-Zugang beschrieben, sollte auch
hier der Zugriff per mDNS funktionieren.

```
http://xxx.local
```

Falls das nicht funktioniert, kann man es mit den festen IP-Adressen, die in der [Image Konfiguration](../installation/raspberry.md#preparation) festgelegt wurden, versuchen. Die Default-Adresse ist `192.168.30.10`.

```
http://192.168.30.10
```

Das sollte die [Hauptseite](../base/navpage.md) von AvNav laden. Es sollte auch möglich sein, xxxx.local zu benutzen, wenn man sich mit dem Raspberry per SSH verbinden will (z.B. per [putty](https://www.putty.org/) unter Windows).

Eine Einschränkung bleibt: Leider funktioniert xxx.local nicht auf Android-Geräten. Daher empfiehlt es sich, dort ein Tool zu nutzen, das mDNS nutzen kann - einen [BonjourBrowser](https://play.google.com/store/apps/details?id=de.wellenvogel.bonjourbrowser) . Für IOS gibt es ein  [vergleichbares
Tool](https://apps.apple.com/us/app/bonjour-search-for-http-web-in-wi-fi/id1097517829) - auch wenn dort der Eintrag "xxx.local" im Browser funktioniert. Man wird seinen Raspberry mit dem AvNav-Image in den Browsern unter dem Namen "avnav-server" finden. Typischerweise wird man
noch einen zweiten Eintrag "avnav" sehen - dahinter verbirgt sich der [SignalK](signalk.md)-Server auf dem Raspberry.  
Wenn man seinen Raspberry im Bonjour-Browser sehen kann, der Aufruf der
Seite dann aber fehlschlägt, kann es an einer Besonderheit von Android
liegen, wenn zusätzlich z.B. per Mobilfunk eine Internet-Verbindung aktiv
ist. In diesem Falle sollte man die mobilen Daten zeitweilig abschalten.

Ab der Version 1.12 unterstützt die "Android Bonjour Browser App" auch SSH.
Das AvNav Image (ab 20220421) macht auch seinen SSH Zugang per mDNS bekannt. Wenn man unter Android dann noch einen passenden SSh Client installiert (beispielsweise [JuiceSSH](https://play.google.com/store/apps/details?id=com.sonelli.juicessh&hl=de&gl=US)), kann man sich auf diese Weise auch per SSH mit dem Pi verbinden. Das ist für ein normales Arbeiten meist nicht so komfortabel - aber für den Notfall kann man so ein paar Kommandos eingeben.

Wenn man sich per SSH verbindet, ist der Nutzername "pi". Das
Nutzer-Passwort wurde (hoffentlich) in der Datei "avnav.conf" gesetzt.  

Wenn das in der Konfiguration gesetzte Passwort nicht funktioniert, kann
man noch einmal das Default-Passwort versuchen. Es lautet "raspberry".
Eventuell wurde die *avnav.conf* zuvor nicht korrekt gespeichert.  
Eine Root-Shell kann man mit *sudo -i* erhalten.

### Verbindung von Android über USB {: #connect-usb}

Dazu benötigt man ein Android-Gerät, das USB Tethering unterstützt. Das ist meist in den Verbindungseinstellungen zu erkennen. Nachdem man das Gerät per USB mit dem
Pi verbunden hat, muss man das USB Tethering einschalten. Das wird meist
automatisch wieder ausgeschaltet, wenn man die Verbindung trennt.  
Neben der Möglichkeit, den Pi so mit dem Internet zu verbinden, kann man
auch auf den Pi mit dem Browser oder per SSH zugreifen. Da dazu auch wieder die
Ermittlung der IP-Adresse erfolgen muss, empfehle ich wieder die [Bonjour
Browser App](https://play.google.com/store/apps/details?id=de.wellenvogel.bonjourbrowser) zu installieren - siehe unter [WLAN](#connect-wifi).
Für SSH-Zugriffe ebenfalls wieder [JuiceSSH](https://play.google.com/store/apps/details?id=com.sonelli.juicessh&hl=de&gl=US).

Über diesen Weg kann man auch auf den Pi zugreifen, falls z.B. das WLAN
nicht funktioniert. Im Bonjour Browser wird man mindestens 2 http:-Adressen finden:
Port 8080 für AvNav und Port 3000 für SignalK, dazu (ab Version 20220421) noch
einen SSH Zugang.

### Verbindung über ein anderes WLAN {: #connect-clientwifi}

Wenn man wie unten beschrieben eine WLAN-Verbindung zu einem anderen Netzwerk eingerichtet hat, was einen WLAN Stick erfordert, kann man den Zugriff auf den Pi über dieses Netzwerk freigeben ("external access" beim Aufsetzen).

Das sollte man aber nur in einem geschützten Netzwerk tun, z.B. im Netz
des eigenen LTE-Routers. **Auf keinen Fall sollte man das in einem
öffentlichen WLAN erlauben - der Zugriff ist nicht geschützt und
prinzipiell kann jeder aus dem Netz auf den Pi zugreifen**.

Wenn man mit dem Client-Netzwerk verbunden ist, kann man wieder wie unter
[WLAN](#connect-wifi) beschrieben auf den Pi zugreifen.

## Pi mit dem Internet verbinden

Für einige Funktionen z.B. zum Update von Software benötigt der Pi eine
Internet-Verbindung. Diese wird natürlich nicht für die grundlegenden
Navigationsfunktionen benötigt.

Vor der Image-Version 20220421 ist dabei zu beachten, dass der Pi seine
Systemzeit nicht automatisch einstellt, solange kein GPS angeschlossen
ist. Das kann bei vielen Internet-Zugriffen zu Problemen führen.   
Ab der Version 20220421 synchronisiert der Pi nach einer gewissen Wartezeit
automatisch seine Systemzeit mit dem Netz (NTP).

Für die Verbindung zum Internet gibt es die folgenden Möglichkeiten:

1. Ethernet-Verbindung zu einem Router
2. Verbindung über ein anderes WLAN
3. Verbindung über ein per USB angeschlossenes Android-Gerät

Der Pi stellt seine Internet-Verbindung grundsätzlich über sein eigenes
WLAN auch verbundenen Geräten zur Verfügung.

### Verbindung über Ethernet Kabel

Hier wird der Pi über ein Ethernet-Kabel an einen Router angeschlossen.  
Dazu ist auf dem Pi nichts weiter einzurichten, das sollte automatisch
gehen.  
Auf einigen Pi3 kann es vorkommen, dass ein Netzwerkkabel, das erst nach
dem Bootvorgng angeschlossen wird, nicht richtig erkannt wird. In diesem
Falle den Pi mit angeschlossenem Netzwerkkabel neu starten.

### Verbindung über ein anderes WLAN

Dazu wird ein weiterer WLAN-Adapter (USB-Stick) benötigt. Bitte vorher
die Kompatibilität mit dem Pi prüfen - z.B. [hier](https://elinux.org/RPi_USB_Wi-Fi_Adapters).

Über 

{{MM("MMserverpage")}} -> ![](../../img/wifi.svg){.inline-image}

kann man den [Wifi Dialog](serverpage.md#wifi) aufrufen.

### Verbindung über ein per USB angeschlossenes Android Gerät

Wie bereits beim [Zugriff](#connect-usb) beschrieben, kann man ein Android-Gerät mit USB Tethering verbinden. Intern ensteht ein Netzwerkinterface *usb0*.  
Darüber kann der Pi ebenfalls auf das Internet zugreifen.

Das kann eine einfache Möglichkeit sein, wenn man den Zugriff nur
temporär braucht und keinen zusätzlichen WLAN-Adapter zur Verfügung hat.  
Falls man vorher anders mit dem Internet verbunden war, kann es sein, dass
der Pi die USB-Verbindung erst nach einem Neustart wirklich nutzt.

**Achtung:** USB Tethering auf dem Android-Gerät wieder einschalten, wird
beim Pi-Neustart normalerweise ausgeschaltet.

## Technische Details

Auf dem Raspberry wird ein [NetworkManager](https://networkmanager.dev/) für die Netzwerk-Konfiguration verwendet.
Das Paket `avnav-raspi-network` bringt Basis-Konfigurationen mit, die dafür sorgen, dass sich das Ethernet-Interface seine IP per DHCP holt und ein Hotspot auf dem internen Wifi Interface aufgesetzt wird.
Einige Parameter lassen sich für die Images [anpassen](../installation/raspberry.md#preparation).
Außerdem wird mit [firewalld](https://firewalld.org/) eine Firewall so aufgesetzt, das Ethernet und Hotspot in einer "trusted zone" sind - und eine potenziell zusätzliche Wifi-Verbindung ja nach Konfiguration entweder auch in dieser Zone ist (`externalAccess` eingeschaltet) - oder in einer separaten "public zone".

Für die meisten Aktionen sollte ein Kommandozeilen-Zugang jedoch nicht
erforderlich sein. Für Updates nutzt man das bereits vorinstallierte [Update-Plugin](https://github.com/wellenvogel/avnav-update-plugin).