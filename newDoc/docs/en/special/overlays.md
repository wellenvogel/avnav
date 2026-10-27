---
  tags:
    - Overlays
    - Maps
---
# Overlay Details

As described in the [Introduction to Overlays](../base/overlays.md), you can add additional display layers (overlays) to a map.

These overlays are usually files containing geographical information as well as information about their presentation. AvNav can process data in [GPX format](https://en.wikipedia.org/wiki/GPS_Exchange_Format)<!--@@linkchanged-->, [GEOJSON format](https://geojson.org/), or [KML/KMZ format](https://en.wikipedia.org/wiki/Keyhole_Markup_Language)<!--@@linkchanged-->. Additionally, existing data in AvNav, such as tracks and routes, can be used as overlays.
To be completely flexible, you can also add other maps as an overlay to a specific map. This can be very helpful if the maps cover separate areas – this allows for a seamless display.

The [Introduction](../base/overlays.md#parameters) explains how to edit overlay settings. Some details are described here.

## Overlay Geometries and Properties {: #geometry}

All overlay files contain so-called geometry objects. These are, for example, points, lines, lines consisting of multiple segments (such as tracks or routes), or areas described by polygons.
Such geometry objects have properties that describe how they should be displayed on the map. These include, for example, colors, point sizes, line thicknesses, text, text sizes, etc.

Depending on the overlay type, these properties have fixed values, or the values must be defined by the user.

In the [Properties Dialog](../base/overlays.md#parameters), you can only define values for all objects of a certain type within an overlay file, e.g., the line thickness or color for all lines. However, in the files themselves, these properties can potentially differ for each object (e.g., KML files).

Besides the properties that directly influence the display, geometry objects can have further properties, such as explanatory text or even entire HTML pages. These are usually not displayed on the map, but can be viewed after clicking on the map via the [Feature Info](#featureInfo) feature. See also [Feature Formatter](#featureFormatter).

## Display Properties

Some display properties were already explained in the [Introduction](../base/overlays.md#parameters). Additional properties appear in the overlay dialog if the overlay file contains geometry objects with a corresponding type. The property `line width`, for example, is only displayed if there are line objects present. The parameters each have a short help text.

## Icons

Some overlay file types (e.g., KML/KMZ) support specifying an icon URL for points. These URLs can be absolute external URLs, or relative/absolute internal URLs that point to the AvNav server.

For these icons to be displayed, they must, of course, exist. For external URLs, `allow online` must be set in the dialog to enable them. For relative URLs, the icons must either be uploaded to the overlay directory as an overlay file, or they must be packed into a ZIP file with the same path structure as defined in the overlay file. This ZIP file must then also be uploaded to AvNav as an overlay file and specified via the `icon file` parameter in the dialog.

The object property describing the icon is `sym`. Under [Feature Formatter](#featureFormatter), it is described how you can influence the determination of the icon URL.

## Feature Info {: #featureInfo }

When you click on a displayed overlay object on the map, it will appear in the [Feature Info List](featureinfo.md).

![Overlay Feature Info](../../img/overlays-featureinfo1.png)
///caption
Overlay Feature Info
///

After clicking on the overlay, you receive information about the object you just clicked from the overlay.

![Overlay Feature Detail](../../img/overlays-featureinfo2.png)
///caption 
Overlay Detail
///
Here, some of the [Properties](#geometry) of the object are displayed. 
Which properties are shown depends on the overlay type and the [Feature Formatter](#featureFormatter).

The default properties are:

  * `name`
  * `desc` (displayed as `description`)
  * `time`
  * `sym` (displayed as `symbol`)

In addition, [Feature Formatters](#featureFormatter) can set further properties:

  * `buoy`
  * `top`
  * `light`
  * `link`: 
    a URL. If this value is set, the button {{DB("DBInfo")}} is displayed as shown in the image, which opens a dialog with the HTML page.
  * `htmlInfo`: 
    also shows the button {{DB("DBInfo")}} and opens a dialog that displays the value of the parameter as HTML.
  * `linkText` - a title for the HTML display.

## Feature Formatter {: #featureFormatter}

Since AvNav cannot know all conceivable formats and special contents of overlays, it is possible to influence how information from overlays is displayed. 

To do this, you need to write a few lines of JavaScript code and make them available to AvNav.

Such a formatter is a JavaScript function that receives the properties of the geometry object as a parameter and returns modified properties.
These returned properties can then influence both the display on the map (`sym` for the symbol URL, `name`) and the display in the [Feature Info](#featureInfo).

Essentially, you need to edit the `user.mjs` file:

{{MM("MMaddonconfigpage")}}->"User Files" -> "user.mjs" -> {{DB("Edit")}}

and add an entry for the formatter there, as described under [User Java-Script](userjs.md#featureFormatter).

[Plugins](plugins.md) can also provide such feature formatters.

The name of the feature formatter must then be selected from the displayed list in the overlay dialog under `feature formatter`.