---
  tags:
    - Configuration
    - Wifi
    - Bookworm
---

The Legacy Wifi Configuration Page
============================
__Attention:__
This page describes the AvNav Wifi configuration on [AvNav Bookworm Images](../installation/raspberry.md#images). For images based on Trixie (and newer), there is a [new configuration](serverpage.md#wifi).


You can reach this page from the [Server Page](serverpage.md) using the
Button{{BT("StatusWpa")}}.

![](../../img/wpapage.png)

This page is only displayed if Wifi Client Handling is configured in the
*avnav_server.xml* (the default is *on*). You can only configure connections
if a WLAN adapter has been plugged into the correct USB port or if
*InternalWifi as Client* has been set to "yes" in the
[*avnav.conf*](../installation/raspberry.md#preparation).

![](../img/raspi3-wlan.jpg)

The image shows a Raspberry Pi 3. On newer Raspis with USB 3.0
(blue ports), the adapter must be plugged into the blue USB 3.0 port on the
PCB side.

At the system level, a WLAN interface "wlan-av1" must be visible. In the
configuration file *avnav_server.xml*, there must be an entry in the form of:

```
<AVNWpaHandler wpaSocket="/var/run/wpa_supplicant/wlan-av1">
</AVNWpaHandler>
```

On the Wifi client connection page, all reachable or configured
WLANs are displayed.

Clicking on a displayed WLAN will initiate a connection.

![](../../img/wpa-connect.png)

If external access to the Raspberry is required, "External Access" can be enabled here.

**Attention: This should not be activated in public WLANs, as
AvNav does not provide special protection, and anyone in the same WLAN
could access the system without restriction.**

However, it can be used, for example, if you are using an LTE router and
your own devices are supposed to be connected directly to it.

Once the connection is established, it will be indicated accordingly,
and the connected network will be highlighted in gray.

![](.././img/wpapage-connected.png)

During the connection process, status information is displayed
under "Interface".

If you want to disconnect from the WLAN, you can click on the
network again to disconnect, disable, or completely remove it from the
configuration.

![](.././img/wpapage-modify.png)

The WLAN information is stored in the file
/etc/wpa_supplicant/wpa_supplicant.conf.