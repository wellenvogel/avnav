---
  tags:
    - Anchor
    - AnchorWatch
    - Alarm
---

# Anchor Watch

AvNav includes an anchor watch feature. The function runs entirely on the AvNav server, or on Android within the AvNav app. The anchor watch remains active even if no display device is connected or if AvNav is running in the background on Android.

An anchor alarm is triggered if the defined area is left.

![Anchor Alarm](../../img/anchorwatch-active.png)
///caption
Anchor watch alarm
///

## Android Alarm
On Android, the alarm is displayed when a display device is connected or AvNav is running in the foreground.
Additionally, an alarm sound is triggered ([configurable](../installation/android.md#android-sound-einstellungen)).
The alarm can be acknowledged via the display or by opening the AvNav notification.

## Linux/Raspberry/Windows Alarm
On a connected display device (browser), an acoustic alarm and an alarm widget are displayed. The alarm can also be acknowledged there.

As with all alarms, the [command](configfile.md#avncommandhandler) called during an alarm can be customized on the server, e.g., to play a sound.
The AvNav [images](../installation/raspberry.md#images) are configured so that the sound is available at the computer's audio output. This allows, for example, a speaker to be connected there to output the alarms.

Furthermore, a specific action (a command to be executed) can be defined in the [configuration of the AlarmHandler](configfile.md#avnalarmhandler). This can be used to control external hardware, for example. 
On the AvNav [images](../installation/raspberry.md#images), there is also a plugin available to reset alarms using a GPIO pin.

## Activation

On the navigation page, the anchor watch can be activated via

{{BT("NavActions")}}->{{BT("AnchorWatch",True)}}

- on the dashboard pages by clicking the {{BT("AnchorWatch")}} button.

![Anchor Watch](../../img/anchorwatch-start.png)
///caption
Start anchor watch
///

In the dialog, you can choose whether the boat's position or the map center should be used as the anchor position. Additionally, the permissible distance to the anchor position (radius) and optionally an offset to the current position can be set. This allows you, for example, to take the length of the anchor chain and its direction into account.

After activation, the {{BT("AnchorWatch")}} button gets a green border and monitoring starts. When the distance is exceeded, the alarm described above is triggered.

Furthermore, an alarm is also triggered if the GPS signal is lost while the anchor watch is active. 

With an active anchor watch, the [layout condition](../base/layout.md) "anchor" becomes active, and some displays change their content.

![Anchor Watch Dashboard](../../img/anchorwatch-dash.png)
///caption
Anchor watch widgets
///

## Edit/Stop

When the anchor watch is active, a small red anchor icon is displayed on all pages. Clicking on it opens a dialog to edit or stop the anchor watch.

![Anchor Watch Stop](../../img/anchorwatch-stop.png)
///caption
Anchor watch stop dialog
///

The anchor position can be modified with {{DB("DBAnchorBoat")}} and {{DB("DBAnchorCenter")}}.

The anchor watch continues unchanged with {{DB("DBCancel")}}.