---
  tags:
    - Verbindung
    - Raspberry
---
## Verbinden mit dem Raspberry Pi

Wenn man einen Raspberry Pi mit einem [AvNav Image](../installation/raspberry.md#images) gestartet hat. kann man sich anschliessend mit diesem Pi verbinden. Die verschiedenen Möglichkeiten dafür werden hier beschrieben.

Wenn das Image für einen lokalen Bildschirm konfiguriert wurde, kann man
natürlich direkt mit einem angeschlossenen Bildschirm, ggf. noch Tastatur
und Maus arbeiten.

Allerdings sollte man auch diesem Falle eine der hier im Folgenden
beschriebenen Verbindungen vorbereiten - die braucht man eventuell in
Fehlersituationen.

Prinzipiell kann man sich auf mehrere Arten mit dem Raspberry verbinden:

1. per Ethernet-Kabel  
   Das geht entweder durch Anschluss an einen einen Router oder Switch oder
   über eine einfache Verbindung z.B. direkt zu einem Laptop.
2. per internem WLAN  
   Standardmässig macht der Pi einen Access-Point mit der in der
   Konfiguration gewählten SSID auf. Er hängt dort jeweils noch eine Nummer
   an (falls man weitere WLAN-Adapter anschliesst, kann man auch mehrere
   Access Points erzeugen).
3. per USB von einem Android Gerät  
   Moderne Android-Geräte haben meist eine "USB-Tethering" Funktion, über
   die man das WLAN oder die Mobilfunk-Verbindung per USB weitergeben kann
   (leider meist nur Geräte mit Mobilfunk).   
   Über diesen Weg kann man sich auch mit dem Pi verbinden.
4. Über ein anderes WLAN.  
   Das erfordert aber zunächst eine der anderen Verbindungsmöglichkeiten,
   da man die Zugangsdaten einstellen muss. Außerdem erfordert es einen
   zusätzlichen WLAN Adapter, der in eine bestimmte USB-Buchse gesteckt
   werden muss (außer man hat in der Konfiguration "Internal Wifi as
   Client" gewählt).

#### Verbindung per Ethernet-Kabel

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

xxx ist dabei der in der Image-Konfiguration gewählte Hostname.  
Auch ein Zugang per SSH (unter Windows z.B. per [putty](https://www.chiark.greenend.org.uk/%7Esgtatham/putty/))
íst auf diese Weise möglich - das Zugangs-Passwort für den Nutzer pi wurde
bereits in der Image-Konfiguration gesetzt.

Falls man sich mit einem Netzwerkkabel direkt z.B. mit einem Laptop
verbindet, wird der Pi nach einiger Zeit selbständig eine IP-Adresse
aufsetzen. Das kann 1...2 Minuten dauern. Diese gehört zum sogenannten
Automatic Private IP Addressing-Bereich 169.254.x.x. Die meisten Desktop
Systeme unterstützen das ebenfalls (unter Linux muss man es ggf. explizit
anschalten).   
Wenn also der Laptop auch auf seinem Ethernet Interface eine solche
Adresse aufgesetzt hat, sollte eine Verbindung wie beschrieben per
xxxx.local funktionieren.

Falls der Zugriff über die xxx.local Adresse nicht funktionieren sollte,
muss man versuchen, die IP-Adresse des Pi zu ermitteln (z.B. in der
Administration des heimischen Routers).

#### Verbindung über das eingebaute WLAN {: #connect-wifi}

Man kann das WLAN-Netzwerk verwenden, das der Raspberry erzeugt hat. Die
SSID und das Passwort wurden wie oben beschrieben in der Datei
"avnav.conf" definiert (mit noch einer angehängten Nummer).

Auch hier steht man vor dem Problem, zunächst die IP-Adresse des Pi
herauszufinden. Wie schon beim Ethernet-Zugang beschrieben, sollte auch
hier der Zugriff per mDNS funktionieren.

```
http://xxx.local
```

Falls das nicht funktioniert, kann man es mit den festen IP-Adressen
192.168.30.10, 192.168.40.10, 192.168.50.10, 192.168.60.10 versuchen:

```
http://192.168.30.10
```

Das sollte die [Hauptseite](userdoc/index.md) von AvNav
laden. Es sollte auch möglich sein, xxxx.local zu benutzen, wenn man sich
mit dem Raspberry per SSH verbinden will (z.B. [putty](https://www.putty.org/)
unter Windows).

Eine Einschränkung bleibt: Leider funktioniert xxx.local nicht auf
Android-Geräten. Daher empfehle ich, dort ein Tool zu nutzen, das mDNS
nutzen kann - einen [BonjourBrowser](https://play.google.com/store/apps/details?id=de.wellenvogel.bonjourbrowser) . Für IOS gibt es ein  [vergleichbares
Tool](https://apps.apple.com/us/app/bonjour-search-for-http-web-in-wi-fi/id1097517829) - auch wenn dort der Eintrag "xxx.local" im Browser
funktioniert. Man wird seinen Raspberry mit dem AvNav-Image in den
Browsern unter dem Namen "avnav-server" finden. Typischerweise wird man
noch einen zweiten Eintrag "avnav" sehen - dahinter verbirgt sich der [SignalK](hints/CanboatAndSignalk.md)-Server auf dem
Raspberry.  
Wenn man seinen Raspberry im Bonjour-Browser sehen kann, der Aufruf der
Seite dann aber fehlschlägt, kann es an einer Besonderheit von Android
liegen, wenn zusätzlich z.B. per Mobilfunk eine Internet-Verbindung aktiv
ist. In diesem Falle sollte man mobile Daten zeitweilig abschalten.

Ab der Version 1.12 unterstützt die Android BonjourBrowser App auch SSH.
Das AvNav Image (ab 20220421) macht auch seinen SSH Zugang per mDNS
bekannt. Wenn man unter Android dann noch einen passenden SSh Client
installiert (beispielsweise [JuiceSSH](https://play.google.com/store/apps/details?id=com.sonelli.juicessh&hl=de&gl=US)),
kann man sich auf diese Weise auch per SSH mit dem Pi verbinden. Das ist
für ein normales Arbeiten meist nicht so komfortabel - aber für den
Notfall kann man so ein paar Kommandos eingeben.

Wenn man sich per SSH verbindet, ist der Nutzername "pi". Das
Nutzer-Passwort wurde in der Datei "avnav.conf" (hoffentlich) gesetzt. .  

Wenn das in der Konfiguration gesetzte Passwort nicht funktioniert, kann
man noch einmal das Default-Passwort versuchen. Es lautet "raspberry".
Eventuell wurde die avnav.conf zuvor nicht korrekt gespeichert.  
Eine Root-Shell kann man mit sudo -i erhalten.

#### Verbindung von Android über USB {: #connect-usb}

Dazu benötigt man ein Android-Gerät, das USB Tethering unterstützt (meist
bei den Verbindungseinstellungen). Nachdem man das Gerät per USB mit dem
Pi verbunden hat, muss man das USB Tethering einschalten (wird meist
automatisch wieder ausgeschaltet, wenn man die Verbindung trennt).  
Neben der Möglichkeit, den Pi so mit dem Internet zu verbinden, kann man
auch auf den Pi mit dem Browser oder per SSH zugreifen. Da auch wieder die
Ermittlung der IP-Adresse erfolgen muss, empfehle ich wieder die [Bonjour
Browser App](https://play.google.com/store/apps/details?id=de.wellenvogel.bonjourbrowser) zu installieren - siehe unter [WLAN](#connect-wifi).
Für SSH-Zugriffe ebenfalls wieder [JuiceSSH](https://play.google.com/store/apps/details?id=com.sonelli.juicessh&hl=de&gl=US).

Über diesen Weg kann man auch auf den Pi zugreifen, falls z.B. das WLAN
nicht funktioniert. Im BonjourBrowser wird man 2 http:-Adressen finden
(Port 8080 für AvNav und Port 3000 für SignalK), dazu (ab 20220421) noch
einen SSH Zugang.

#### Verbindung über ein anderes WLAN {: #connect-clientwifi}

Wenn man wie unten beschrieben eine WLAN-Verbindung zu einem anderen
Netzwerk eingerichtet hat (erfordert einen WLAN Stick oder Umschaltung des
internen WLANs auf Client), kann man den Zugriff auf den Pi über dieses
Netzwerk freigeben ("external access" beim Aufsetzen).

Das sollte man aber nur in einem geschützten Netzwerk tun (z.B. das Netz
eines eigenen LTE Routers). **Auf keinen Fall sollte man das in einem
öffentlichen WLAN erlauben - der Zugriff ist nicht geschützt und
prinzipiell kann jeder aus dem Netz auf den Pi zugreifen**.

Wenn man mit dem client-Netzwerk verbunden ist, kann man wieder wie unter
[WLAN](#connect-wifi) beschrieben auf den Pi zugreifen.

### Pi mit dem Internet verbinden

Für einige Funktionen (z.B. Update von Software) benötigt der Pi eine
Internet-Verbindung. Diese wird natürlich nicht für die grundlegenden
Navigationsfunktionen benötigt.

Vor der Image-Version 20220421 ist dabei zu beachten, dass der Pi seine
Systemzeit nicht automatisch einstellt, solange kein GPS angeschlossen
ist. Das kann bei vielen Internet-Zugriffen zu Problemen führen.   
Ab der Version 20220421 synchronisiert der Pi nach einer Wartezeit
automatisch seine Systemzeit mit dem Netz (ntp).

Für die Verbindung zum Internet gibt es die folgenden Möglichkeiten:

1. Ethernet-Verbindung zu einem Router
2. Verbindung über ein anderes WLAN
3. Verbindung über ein per USB angeschlossenes Android-Gerät

Der Pi stellt seine Internet-Verbindung grundsätzlich über sein eigenes
WLAN auch verbundenen Geräten zur Verfügung.

#### Verbindung über Ethernet Kabel

Hier wird der Pi über ein Ethernet-Kabel an einen Router angeschlossen.  
Dazu ist auf dem Pi nichts weiter einzurichten, das sollte automatisch
gehen.  
Auf einigen Pi3 kann es vorkommen, dass ein Netzwerkkabel, das erst nach
dem Bootvorgng angeschlossen wird, nicht richtig erkannt wird. In diesem
Falle den Pi mit angeschlossenem Netzwerkkabel neu starten.

#### Verbindung über ein anderes WLAN

Dazu wird ein weiterer WLAN-Adapter (USB-Adapter) benötigt. Bitte vorher
die Kompatibilität mit dem Pi prüfen - z.B. [hier](https://elinux.org/RPi_USB_Wi-Fi_Adapters).

Der Stick muss wie im Bild gesteckt sein (auf dem Pi4/Pi5 die blaue USB
Buchse an der Platinen-Seite).   
Der interne Name des Netzwerk-Interfaces ist wlan-av1.

![](img/raspi3-wlan.jpg)

Alternativ kann in der Image-Konfiguration "InternalWifi as Client"
gesetzt werden, damit wird der interne WLAN Adapter für die Verbindung zu
anderen Netzten verfügbar. Dann benötigt man aber einen anderen Zugriff
zum Verbinden mit dem Pi, da er keinen Access Point mehr aufmacht.

Man kann die Verbindung zu einem WLAN in der [App](userdoc/wpapage.md)
konfigurieren.  
Bei jedem WLAN, mit dem man sich verbindet, kann man auswählen, ob ein
Zugriff auf den Pi von außen möglich sein soll ("external access"). Wenn
das nicht ausgewählt ist, kann über dieses WLAN nicht auf AvNav
zugegriffen werden. Bitte die [Hinweise zum
Zugriff](#connect-clientwifi) beachten.

#### Verbindung über ein per USB angeschlossenes Android Gerät

Wie bereits beim [Zugriff](#connect-usb) beschrieben, kann
man ein Android-Gerät mit USB Tethering verbinden. Intern ensteht ein
Netzwerkinterface usb0.  
Darüber kann der Pi ebenfalls auf das Internet zugreifen.

Das kann eine einfache Möglichkeit sein, wenn man den Zugriff nur
temporär braucht und keinen zusätzlichen WLAN-Adapter zur Verfügung hat.  
Falls man vorher anders mit dem Internet verbunden war, kann es sein, dass
der Pi die USB-Verbindung erst nach einem Neustart wirklich nutzt
(Achtung: USB Tethering auf dem Android-Gerät wieder einschalten, wird
beim Pi-Neustart normalerweise ausgeschaltet).

### Technische Details

Der Raspberry wird ein (oder mehrere) WLAN-Netzwerke aufsetzen, eines mit
dem internen Adapter und weitere mit potenziell gesteckten WLAN-Sticks.
Diese Netzwerke haben die Adressen:192.168.20.0/24, 192.168.30.0/24,
192.168.40.0/24, 192.168.50.0/24. Der Raspberry selbst hat dabei jeweils
die Adresse 192.168.x.10.

Auf dem Raspberry wird dazu ein DHCP-Server und ein DNS-Server
eingerichtet (dnsmasqd).

Wenn der Raspberry über ein Ethernet-Kabel verbunden wird, versucht er
per DHCP eine Adresse aus dem Netzwerk zu erhalten. Er setzt dann eine
NAT-Weiterleitung aus seinem WLAN-Netz zum Ethernet auf. So kann z.B. eine
Internetverbindung aufgebaut werden, während man in das WLAN des Raspberry
eingewählt ist.

Für die meisten Aktionen sollte ein Kommandozeilen-Zugang jedoch nicht
erforderlich sein. Für Updates nutzt man das bereits vorinstallierte [Update-Plugin](https://github.com/wellenvogel/avnav-update-plugin).
Die Server-Konfiguration kann innerhalb der App auf der [Server/Status](userdoc/statuspage.md)-Seite
vorgenommen werden.