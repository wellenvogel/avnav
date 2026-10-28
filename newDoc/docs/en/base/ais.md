---
  tags:
    - AIS
---

# AIS

On the [navigation page](navpage.md), in addition to the map, the displays (widgets), and navigation information, AIS objects and associated information are also shown. This naturally requires AvNav to receive corresponding [NMEA0183 data sets](../special/nmeadata.md) (AIVDO, AIVDM) or AIS data from [SignalK](../special/signalk.md).

In addition to the display on the map, the projected positions with minimum distance are also calculated.

## Display of objects

In the map view, other ships or AIS objects are represented as colored triangles. The colors can be adjusted in the [settings](#settings). By default, normal targets are yellow, the nearest target is green, and a tracked target is orange.

![AIS-Targets](../../img/aisvectors-tmv.png)

The line extending from the object is the so-called course vector, which shows where the respective AIS object is moving and where it will be in the pre-set time. The default setting is 10 min.

## Settings {: #settings}

These and other settings can be configured under

{{MM("MMsettingspage")}}

and there in the *SettingsGroups* in the *AIS* section.

![AIS-Targets](../../img/ais-settingsgroups.png)


![AIS-Targets](../../img/ais-settings1.png)

It is **extremely important** when navigating to keep in mind that not all ships in the vicinity transmit an AIS signal. A **regular lookout** is therefore essential, despite the AIS display on the digital map.


## Widget functions

To get an up-to-date overview of which AIS targets might pose a collision risk, the AIS widget can be used in the map view. As a rule, the AIS object closest to your own position is displayed there.

![AIS-Targets](../../img/ais-widget-navpage.png)

The colored rectangle at the bottom provides quick visual information: If it is green, there is no danger from the displayed AIS object. If it is red, a collision may occur if conditions remain unchanged.

| Abbreviation | Meaning |
| :--- | :--- | 
| DST | Current distance to the displayed AIS object |
| DCPA | Distance to closest point of approach |
| TCPA | Time to closest point of approach |

**Back** and **Front** show the relative position of the AIS object to your own boat.

Clicking on the AIS widget opens the AIS dialog:

## AIS targets list and AIS dialog

![AIS-Info](../../img/ais-info-dialog.png)
///caption
AIS Info
///

The AIS info dialog displays detailed information about a target.

The locate function {{DB("AisInfoLocate")}} is very suitable for an early response to possible approaches. It brings the selected AIS target "under observation" in the AIS widget.

The "located" AIS target is then displayed in the widget instead of the nearest target, as long as no other target is on a collision course.

This function can be very helpful, for example, to keep an eye on ferries that are entering the same port and might influence your own maneuvers.

With {{DB("AisNearest")}}, you switch back to the normal mode, in which the nearest AIS target (or the most important target with an approach warning) is displayed in the widgets.

Further instructions on usage can be found in the [details](../special/ais.md#aisinfo).

With {{DB("AisItems")}}, you switch to the list of AIS targets.

![AIS-Targets](../../img/aislist.png)

With the *AIS targets* list, you get an overview—independent of the map display—of which ships in the vicinity are broadcasting AIS signals.


## AIS menu

The AIS functions can be accessed not only via the map display but also via the menu and the *AIS* menu item.

{{MM("MMaiscfgpage")}}


## Details
For details regarding display and calculations related to AIS, see the [detailed information](../special/ais.md) in the *Details* section.