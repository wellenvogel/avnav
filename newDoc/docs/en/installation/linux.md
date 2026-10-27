---
  tags:
    - Linux
    - Installation
---

# Linux

AvNav can be installed on many Linux systems because it is based on Python and the necessary packages are available for most distributions.
Development and testing focus on Debian/Ubuntu, but other distributions are also possible.

## Package installation { #packages}

### Repositories
Thanks to [Oleg](https://www.free-x.de), there are ready-made package repositories that can be integrated into your
Debian Linux. This works on the Raspberry Pi - but also on
any other Debian variant (e.g., Ubuntu).   

You can include the package sources as follows: 

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

For installation on a Linux system, you must follow these steps after integrating the
package sources:

```
sudo apt update
sudo apt install avnav
```
### Download packages

Alternatively, you can download the Debian/RPM packages directly from the
download page:  

* [Releases]({{DLLINK("release")}})
* [Daily builds]({{DLLINK("daily")}})

After downloading, you can install the packages with

```
sudo apt install ./avnav_xxxxxxxx_all.deb
```

### Startup

Afterwards, you can start the server as any user with the command  
```
avnav
```
It then runs directly under the respective user ID and stores its data in the home directory under `/avnav`.

With   
```
sudo systemctl enable avnav
sudo systemctl start avnav
```

you can activate AvNav automatically at system startup with the user "avnav". The data will then be stored under `/var/lib/avnav`.

### User Service {: #userservice}

From 20240520 onwards, you can have AvNav automatically started as a [user
systemd service](https://wiki.archlinux.org/title/Systemd/User) for your own user.

To activate this service, call

```
avnavservice enable [port]
```

The service starts automatically when the user logs in and stops when they log out. To activate the service at system startup, you must set "linger mode" for the user:

```
loginctl enable-linger
```

For details, see the [systemd
documentation](https://wiki.archlinux.org/title/Systemd/User).

To check the status, use

```
systemctl --user status avnav
```

AvNav uses the (default) data directory `$HOME/avnav`.

To disable the service again, use

```
avnavservice disable
```

### Other user

If you want to start AvNav with a user other than "avnav" - e.g., the user "pi" -
you should use the *systemd user* service as described.

You can then simply start AvNav from the command line as user "pi".  

If you want to run AvNav as a system-wide service with a different user, you can also perform the following steps:

Create
```
/usr/lib/systemd/system/avnav.service.d
```
and create the file `anvav.conf` there with the following content:
```
#Overrides for the avnav service
[Service]
User=pi
ExecStart=
ExecStart=/usr/bin/avnav -q -b /home/pi/avnav/data -t /usr/lib/avnav/avnav_template.xml -n /etc/default/avnav
[Unit]
After=avnav-check-parts.service
```
Afterwards, you can start Avnav as a system service using the commands
```
sudo systemctl daemon-reload  
sudo systemctl enable avnav  
sudo systemctl start avnav
```