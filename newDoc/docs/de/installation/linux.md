---
  tags:
    - Linux
    - Installation
---

# Linux

AvNav kann auf vielen Linux Systemen installiert werden, da es auf Python basiert und die dafür notwendigen Pakete für die meisten Distributionen vorhanden sind.
Schwerpunktmässig erfolgt die Entwicklung und der Test auf Debian/Ubuntu, andere Distributionen sind aber auch möglich.

## Paketinstallion { #packages}

### Repositories
Dank [Oleg](https://www.free-x.de) gibt es  fertige Paket-Repositories, die man in sein
Debian-Linux einbinden kann. Das geht auf dem Raspberry Pi - aber auch auf
jeder anderen Debian-Variante (z.B. Ubuntu).   

Die Paketquellen bindet man wie folgt ein. 

Debian Buster (amd64,armhf,arm64)

```
wget https://www.free-x.de/debian/oss.boating.gpg.key
sudo apt-key add oss.boating.gpg.key
wget https://www.free-x.de/debian/boating-buster.list
sudo cp boating-buster.list /etc/apt/sources.list.d/
```

Debian Bullseye (amd64,armhf,arm64)

```
wget -O - https://www.free-x.de/debian/oss.boating.gpg.key | gpg --dearmor | sudo tee /usr/share/keyrings/oss.boating.gpg
echo "deb [signed-by=/usr/share/keyrings/oss.boating.gpg] https://www.free-x.de/debian bullseye main contrib non-free" | sudo tee -a /etc/apt/sources.list.d/boating.list
```

Debian Bookworm (amd64,armhf,arm64)

```
wget -O - https://www.free-x.de/debian/oss.boating.gpg.key | gpg --dearmor | sudo tee /usr/share/keyrings/oss.boating.gpg
echo "deb [signed-by=/usr/share/keyrings/oss.boating.gpg] https://www.free-x.de/debian bookworm main contrib non-free" | sudo tee -a /etc/apt/sources.list.d/boating.list
```

Debian Trixie (amd64,armhf,arm64)

```
wget -O - https://www.free-x.de/debian/oss.boating.gpg.key | gpg --dearmor | sudo tee /usr/share/keyrings/oss.boating.gpg
echo -e "Types: deb\nURIs: https://www.free-x.de/debian\nSuites: trixie\nComponents: main\nSigned-By: /usr/share/keyrings/oss.boating.gpg" | sudo tee -a /etc/apt/sources.list.d/boating.sources
```

Ubuntu Jammy (amd64)

```
wget -O - https://www.free-x.de/ubuntu/oss.boating.gpg.key | gpg --dearmor | sudo tee /usr/share/keyrings/oss.boating.gpg
echo "deb [signed-by=/usr/share/keyrings/oss.boating.gpg] https://www.free-x.de/ubuntu jammy main" | sudo tee -a /etc/apt/sources.list.d/boating.list
```

Ubuntu Noble (amd64,arm64)

```
wget -O - https://www.free-x.de/ubuntu/oss.boating.gpg.key | gpg --dearmor | sudo tee /usr/share/keyrings/oss.boating.gpg
echo "deb [signed-by=/usr/share/keyrings/oss.boating.gpg] https://www.free-x.de/ubuntu noble main" | sudo tee -a /etc/apt/sources.list.d/boating.list
```

Für die Installation auf einem Linux System muss man nach Einbindung der
Paketquellen die folgenden Schritte ausführen:

```
sudo apt update
sudo apt install avnav
```
### Pakete Herunterladen

Alternativ kann man auch die Debian/RPM -Pakete/ direkt von der Download-Seite
herunterladen:  

* [Releases](../../downloads/release "downloads/releases")
* [Tägliche Builds](../../downloads/daily)

Nach dem Herunterladen kann man die Pakete mit

```
sudo apt install ./avnav_xxxxxxxx_all.deb
```
installieren.  


### Startup

Danach kann man als beliebiger Nutzer mit dem Kommando  
```
avnav
```
den Server starten.  Er läuft dann direkt unter der jeweiligen Nutzerkennung und legt seine Daten im Home-Verzeichnis unter avnav ab.

Mit   
```
sudo systemctl enable avnav
sudo systemctl start avnav
```

kann man AvNav mit dem Benutzer "avnav" automatisch beim Systemstart
aktivieren. Die Daten werden dann unter /var/lib/avnav abgelegt.

### User Service {: #userservice}

Ab 20240520 kann man AvNav als ein [user
systemd service](https://wiki.archlinux.org/title/Systemd/User) für den eigenen Nutzer automatisch starten lassen.
Um diesen Service zu aktivieren, ruft man

```
avnavservice enable [port]
```

auf. Der Service startet automatisch, wenn sich der Nutzer einloggt, und
stoppt, wenn er sich abmeldet. Um den Service bereits beim Systemstart zu
aktivieren, muss man den "linger" mode für den Nutzer setzen:

```
loginctl enable-linger
```

Für Details siehe die [systemd
Dokumentation](https://wiki.archlinux.org/title/Systemd/User).

Um den Status zu prüfen, nutzt man

```
systemctl --user status avnav
```

AvNav nutzt das (default) Datenverzeichnis $HOME/avnav.

Um den Service wieder zu deaktivieren, nutzt man

```
avnavservice disable
```

### Anderer Nutzer

Wenn man AvNav mit einem
anderen Nutzer als "avnav" - also z.B. dem Nutzer pi starten möchte, 
sollte man wie beschrieben den Start als systemd user Service nutzen.

Man kann dann als Nutzer "pi" AvNav einfach von der Kommandozeile starten
lassen.  

Wenn man AvNav als systemweiten Service mit einem anderen Nutzer laufen
lassen möchte, kann man auch folgende Schritte abarbeiten:

```
/usr/lib/systemd/system/avnav.service.d
```
anlegen und dort die Datei anvav.conf mit folgendem Inhalt anlegen:
```
#Overrides for the avnav service
[Service]
User=pi
ExecStart=
ExecStart=/usr/bin/avnav -q -b /home/pi/avnav/data -t /usr/lib/avnav/avnav_template.xml -n /etc/default/avnav
[Unit]
After=avnav-check-parts.service
```
Danach kann man mit den Kommandos
```
sudo systemctl daemon-reload  
sudo systemctl enable avnav  
sudo systemctl start avnav
```

Avnav als Systemdienst starten. 