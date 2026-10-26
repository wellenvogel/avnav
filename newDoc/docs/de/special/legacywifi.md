---
  tags:
    - Konfiguration
    - Wifi
    - Bookworm
---

Die Legacy Wifi-Konfigurationsseite
============================
__Achtung:__
Diese Seite beschreibt die AvNav Wifi-Konfiguration auf [AvNav Bookworm Images](../installation/raspberry.md#images). Auf Images für Trixie (und neuer) gibt es eine [neue Konfiguration](serverpage.md#wifi).


Von der [Server-Seite](serverpage.md) kommt man mit dem
Button{{BT("StatusWpa")}} zu dieser Seite.

![](../../img/wpapage.png)

Diese Seite wird nur angezeigt, wenn das Wifi Client Handling
in der *avnav\_server.xml*  konfiguriert ist (Der Defaulteintrag ist *an*). Man kann
nur Verbindungen konfigurieren, wenn ein WLAN-Adapter in die richtige
USB-Buchse eingesteckt wurde oder in der [*avnav.conf*](../installation/raspberry.md#preparation)
*InternalWifi as Client* auf "yes" gesetzt wurde.

![](../img/raspi3-wlan.jpg)

Das Bild zeigt ein Raspberry Pi 3. Bei den neueren Raspis mit USB 3.0
(blaue Buchsen) muss der Adapter in der blauen USB-3-Buchse auf der Leiterplatten-Seite
stecken.

Auf Systemebene muss ein WLAN "wlan-av1" angezeigt werden. In der
Konfiguration in der Datei *avnav\_server.xml* muss ein Eintrag in der Form

```
<AVNWpaHandler wpaSocket="/var/run/wpa_supplicant/wlan-av1">
</AVNWpaHandler>
```

vorhanden sein.

Auf der Wifi Client connection-Seite werden alle in Reichweite befindlichen oder konfigurierten
WLANs angezeigt.

Durch Klick auf ein angezeigtes WLAN kann eine Verbindung hergestellt werden.

![](../../img/wpa-connect.png)

Falls ein Zugriff von außen auf den Raspberry erfolgen soll, kann hier
"External Access" eingeschaltet werden.

**Achtung: Das sollte nicht in öffentlichen WLANs aktiviert werden, da
AvNav keinen besonderen Schutz bietet und sonst jeder im gleichen WLAN
ungehindert zugreifen kann.**   

Es kann aber z.B. genutzt werden, wenn man einen LTE-Router nutzt und
die eigenen Geräte direkt mit diesem verbunden sein sollen.

Wenn die Verbindung hergestellt wurde, wird das entsprechend angezeigt,
das verbundene Netzwerk ist dann grau hinterlegt.

![](.././img/wpapage-connected.png)

Während des Verbindungsaufbaus werden bei "Interface"
Zustandsinformationen angezeigt.

Falls man das WLAN trennen möchte, kann man durch erneuten Klick auf das
Netzwerk dieses trennen, deaktivieren oder auch komplett aus der
Konfiguration entfernen.

![](.././img/wpapage-modify.png)

Die WLAN-Informationen werden in der Datei
/etc/wpa\_supplicant/wpa\_supplicant.conf gespeichert.

  