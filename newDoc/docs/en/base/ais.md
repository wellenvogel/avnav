---
  tags:
    - AIS
---

# AIS

On the [navigation page](navpage.md), in addition to the map, widgets, and navigation information, AIS objects and associated information are displayed. This naturally requires AvNav to receive corresponding [NMEA0183 data sets](../special/nmeadata.md) (AIVDO, AIVDM) or AIS data from [SignalK](../special/signalk.md).

In addition to the display on the map, the predicted positions with minimum distance are also calculated.

## Display of objects

In the map view, other ships or AIS objects are displayed as colored triangles. The colors can be adjusted in the [settings](#settings). By default, normal targets are yellow, the nearest target is green, and a tracked target is orange.

![AIS-Targets](../../img/aisvectors-tmv.png)

The leading line is the so-called course vector, which shows where the respective AIS object is moving and where it will be in the pre-set time. The default setting is 10 min.

## Settings {: #settings}

These and other settings can be configured under

{{MM("MMsettingspage")}}

and there in the *SettingsGroups* in the *AIS* section.

![AIS-Targets](../../img/ais-settingsgroups.png)


![AIS-Targets](../../img/ais-settings1.png)

It is **extremely important** when navigating to keep in mind that not all ships in the vicinity transmit an AIS signal. A **regular lookout** is therefore essential, despite the AIS display on the digital map.


## Widget functions

To get a current overview of which AIS targets might cause a risk of collision, the AIS widget can be used in the map display. As a rule, it displays the AIS object that is closest to your own position.

![AIS-Targets](../../img/ais-widget-navpage.png)

The colored rectangle at the bottom provides quick visual information: If it is green, there is no danger from the displayed AIS object. If it is red, a collision may occur if conditions remain the same.

| Abbreviation | Meaning |
| :--- | :--- | 
| DST | Current distance to the displayed AIS object |
| DCPA | Distance to Closest Point of Approach |
| TCPA | Time to Closest Point of Approach |

**Back** and **Front** show the relative position of the AIS object to your own boat.

Clicking on the AIS widget opens the AIS dialog:

## AIS targets list and AIS dialog

![AIS-Info](../../img/ais-info-dialog.png)
///caption
AIS Info
///

The AIS Info dialog displays detailed information about a target.

The Locate function {{DB("AisInfoLocate")}} is very suitable for early reaction to possible approaches. You can use it to pull the selected AIS target into the AIS widget for "observation".

From that point on, the "located" AIS target is displayed in the widget instead of the nearest target, as long as no other target is on a collision course.

This function can be very helpful, for example, to keep an eye on ferries that will enter the same harbor and could influence your own maneuvers.

Use {{DB("AisNearest")}} to switch back to normal mode, where the nearest AIS target (or the most important target with an approach warning) is displayed in the widgets.

Further notes on usage can be found in the [details](../special/ais.md#aisinfo).

Use {{DB("AisItems")}} to switch to the list of AIS targets.

![AIS-Targets](../../img/aislist.png)

With the *AIS targets* list, you get an overview of which ships in the vicinity are broadcasting AIS signals, independent of the map display.


## AIS menu

The AIS functions can be accessed not only via the map display, but also via the menu under the *AIS* menu item.

{{MM("MMaiscfgpage")}}


## Details
For details on display and calculation regarding AIS, see the [detailed information](../special/ais.md) in the *Details* section.