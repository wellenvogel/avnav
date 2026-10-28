---
  tags:
    - Overlay

---

# Overlays

{{VIDEO("Hier","overlays")}} leads to a video that explains the basic functions.

## Introduction

Overlays are used to supplement maps in AvNav with additional information.
This means that maps are layered with additional data and visual representations in order to display extra information on the map or to meaningfully expand the current map.

An example is the use of a map for Germany - but the sailing area is the border region between Germany and Denmark in the Flensburg Fjord.

This would mean having to switch back and forth between a Danish and a German map depending on the course and position. To avoid this, you can add another map as an overlay to a map in AvNav. This makes both maps visible in the navigation view and creates a seamless transition.

Likewise, you can download information from other sources to display a waypoint directory on the map, or for example, a directory of Danish mooring buoys, and much more.

It is also possible to import routes and tracks into the map to compare them or to use them as a template for a new route to be created.

Satellite images can also be superimposed on AvNav maps; however, this requires a source for satellite maps and some preparation.

## Assignment {: #assign}

How are overlays assigned to specific maps?
To place two maps existing in the system side by side, you can choose a very fast way, namely directly from the navigation page using the {{BT("NavSelectChart")}} button.

For one of the maps that you want to place side by side, click on the *Overlay* button on the right. This opens the *Edit Overlays* dialog.

![Overlay Dialog](../../img/overlays-dialog1.png)
///caption
Overlay dialog
///

There, click the {{DB("DBInsertAfter")}} button to add another map to the base map.

Another dialog opens; there, select the "chart" option and click on the "name" line. Now you can choose from one of the installed maps.

![Overlay Dialog](../../img/overlays-dialog2.png)
///caption
Map as overlay
///

After clicking on {{DB("DBOk")}}, you return to the initial *Edit Overlay* dialog and confirm the new overlay with {{DB("DBSave")}}.

In the map list, you can recognize the overlay by the blackened icon to the right of the map name.

To insert a route, a waypoint list, or a buoy directory as an overlay, you must first download the corresponding files somewhere and insert them into AvNav. AvNav accepts such files in GPX, KML, KMZ, and GEOJSON formats.

After the source files have been saved on the computer, you switch in AvNav to the section

{{MM("MMchartspage")}}

In the "Overlays" column, you can then upload the files.
As an example, the waypoint list from the NV-Verlag, which is available for free download, is used here.

Click on {{BT("Upload")}}, select the file, and check if it becomes visible in the list under *Overlay*. Now you can follow the same path that was just described for the maps.

Since you are already in the Charts/Overlays section anyway, you can assign a file to a map directly from the overlay list, which is basically the reverse of the path just described.
To do this, click on the pencil icon next to the selected file, then click on *Overlays*, and search for the map you want to assign the overlay to using the unfolding dialog.

![Overlays from file](../../img/overlays-dialog3.png)
///caption
Waypoints as overlay
///

These should, of course, fit together. The buoys of the Danish sailing association will hardly be found on a German or Dutch map...

After assignment, you will receive a dialog that allows you to make various settings for the overlay. For some notes on this, see further [below](#parameters).

Once the assignment of the overlay to the map is created, confirm in the *Edit Overlay* dialog with {{DB("DBSave")}}.

In the map list on the navigation page, you will now find the active overlay icon next to the map just assigned.

You can adjust the settings of an overlay at any time by clicking on the {{SB("Edit")}} symbol of an overlay in the *Edit Overlay* dialog.

Thus, both ways of how maps and overlays can be merged and edited have been shown.

## Showing and hiding

A short note on handling overlays during a trip, for example. It can easily happen that the information superimposed by overlays also interferes with the map display. In order to be able to switch the overlays off quickly, you have the option to do so directly on the navigation page via the Charts button and the displayed map list by clicking on "Hide Overlays".

![Hide overlays](../../img/overlays-dialog5.png)
///caption
Hiding of overlays
///

*Show Overlays* would then quickly reactivate the overlays of the selected map. So that you don't get confused, only the respective option is active, while the other is grayed out.

## Settings {: #parameters}

![Overlay settings](../../img/overlays-dialog4.png)
///caption
Overlay settings
///

During the [assignment](#assign) of overlays or by clicking on the {{SB("Edit")}} symbol in the overlay dialog, you get the opportunity to adjust settings for the display of the overlay on the selected map. If you assign an overlay to several maps, you can make separate settings for each.

The displayed values depend on the type of overlay and each has a help function that describes its function.

The `opacity` can be set in decimal steps from 0-1.

The (framed) values `min zoom` and `max zoom` control the resolution range in which the overlay becomes visible.

`min scale` and `max scale` control the size of icons. At resolutions smaller than `min scale`, the icons are scaled down; at resolutions larger than `max scale`, they are scaled up.
`show text` (1) controls whether the labels become visible on the map.

With `default icon` (2), you can select an icon to be used for points that do not have their own icon defined in the overlay file or if the defined icon is not available in AvNav. You can also use `icon file` to select a (ZIP) file containing symbols for an overlay. This must be uploaded to the overlay files in AvNav beforehand.

For further information, including the description of `feature formatter` (3), see the [detailed descriptions](../special/overlays.md).