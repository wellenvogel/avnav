---
  tags:
    - Feature list
    - Feature info
---

# Feature list and feature info

## Feature list

Clicking on the [map view](../base/navpage.md) opens a dialog containing an overview of the map objects located in the vicinity.

![Feature List](../../img/feature-info1.png).
///caption
Feature list
///

In this list, you will find all display layers that have objects at the clicked position. Clicking on one of these layers opens a second dialog with the details.

## Feature info

The content of the detailed information depends on the display layer, e.g., the [overlay](overlays.md#featureInfo).

![Feature Info Route](../../img/feature-info-route.png)
///caption
Feature info route
///

Here, the route "test0906", which is set up as an overlay on the map, was clicked. The dialog shows information about the route and a series of possible actions. These again depend on the selected object. All feature info dialogs provide a

{{BT("WpGoto")}}

button, which starts immediate waypoint navigation to the selected object.

If you click on an [O-Charts](ochartsng.md) vector map, you get further information about the map objects directly.

![Feature Info O-Charts](../../img/feature-info-ocharts.png)
///caption
Feature info vector map
///

Via {{DB("DBInfo")}}, you can obtain complete information about the map objects here as well. See also the [O-Charts description](ochartsng.md#featureinfo).

## Customizations

The information displayed in a feature info dialog can be customized via both [user JavaScript](userjs.md#featureFormatter) and [plugins](plugins.md).

[Additional map types](charts.md#owntypes) can also influence the display in the feature info. Web pages or external links can also be stored via the {{DB("DBInfo")}} function.