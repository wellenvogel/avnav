---
  tags:
    - Track
    - Route
---

Converting tracks to routes
===========================

AvNav permanently records [tracks](tracks.md).
For each day, a new GPX file with the current date is written.

These tracks, or tracks uploaded on the [tracks page](tracks.md), can be converted into routes to use them for navigation.

Procedure
---------

For this conversion, it is typically necessary to reduce the number of points in the track (tracks often have well over 1000 points). Otherwise, meaningful use of such a route is hardly possible.

AvNav uses a reduction method for this that is based on [GPS Babel](https://www.gpsbabel.org/htmldoc-development/filter_simplify.md). Points are removed one after the other where the deviation from the newly created path between the neighboring points is the smallest.

For this process, you can specify a maximum deviation (xte) that you are willing to tolerate. The larger you choose this allowable deviation, the fewer points will remain at the end. You should typically try to limit routes to approximately 50 points.

After conversion, you can edit the route further in the [route editor](../base/routes.md) if necessary.

Workflow
--------

You can call the conversion dialog either from the [tracks page](tracks.md) after clicking on a track via {{BT("ToRoute")}}, or from the info dialog if you have a track as an [overlay](../base/overlays.md) on the map and click on a point within it. In the info dialog, use the button {{DB("ToRoute")}} again - see image.
![](../../img/FeatureInfo-Track.png)

After clicking the convert button, you will receive the converter dialog after being prompted for the name of the route to be created.

![](../../img/TracksToRoutes1.png)

As seen in the image, you will typically receive a warning that the number of points exceeds 50.

Using *max Xte*, you set the maximum allowable deviation and can start a conversion with *Compute*. If the result or the number of points is not yet suitable, you can perform multiple passes, each with a modified deviation.

![](../../img/TracksToRoutes2.png)

In the example, a sufficiently small route was created with a deviation of 22m.

In the dialog, you can also change the name of the resulting route and, if necessary, decide whether an existing route with the same name should be overwritten.

After saving, you can directly edit the resulting route if necessary.

![](../../img/TracksToRoutes3.png)

It is advantageous here if you had the track as an overlay on the map beforehand; you can then easily compare whether the route contains all important points.

![](../../img/TracksToRoutes4.png)