---
  tags:
    - Route
    - Disconnected
    - Waypoint
---
# Routes
This chapter covers the route function. The procedures are shown **{{VIDEO("in this video","routes")}}**.

## The route editor {: #editor }

The easiest way to create a route is directly from the [navigation page](navpage.md) using the {{BT("ToRoute")}} button. 

![](../../img/route-editor.png)

The map view remains, but the button bar on the right has changed. 

- ### New route <br>
Click into the route widget (RTE) at the bottom left and create a new route by clicking on {{BT("DBNewRoute")}}, giving the route a new name (e.g., "Test"), and confirming twice with {{BT("DBOk")}}.  

Subsequently, the dialog in the widget will show that the route "Test" is now loaded and contains no waypoints yet. 
![](../../img/route-NewRoute.png)

- ### Setting waypoints <br> 
Waypoints are set in AvNav by moving the crosshair to the position where the waypoint should be placed. This is done by clicking on {{BT("NavAddAfter")}}. 'After' and 'Before' refer to the currently selected waypoint. 

This waypoint is highlighted in red on the map and in bold in the WP list of the RTE widget. In this example, you create the route WP1->WP2->WP3 at the crosshair using the {{BT("NavAddAfter")}} button. Consequently, using the {{BT("NavAdd")}} button results in the route WP1->WP3->WP2<br><br>
![](../../img/route-AddWp2.png)


- ### Editing waypoints
To move a waypoint, it must first be selected directly. This can be done either by clicking on it in the map or by selecting its list entry in the RTE widget. Then, position the crosshair at the desired location and move the waypoint using {{BT("NavToCenter")}}. 

Similarly, you can delete a waypoint using the {{BT("NavDelete")}} button.<br>

Working with the crosshair may seem a bit cumbersome at first compared to direct clicks on a touchscreen. However, in situations with a heavily moving ship, on a smaller screen, and with cold fingers, you will appreciate this method of operation.

## Saving and loading routes {: #management}
Changes to routes are generally saved immediately on the AvNav server. If this system behavior is undesirable, for example, because you are editing the currently active route, the so-called *disconnected* mode is recommended: changes remain locally in the browser and are not synchronized to the server until further notice. 

This separation is achieved by deactivating the *connected* mode via the {{BT("DBConnect")}} button in the display area of the "Routes" section. Changes remain local until you re-activate the *connected* mode - you will then be asked what should happen with the changes; they can be applied or discarded.

![](../../img/routespage.png)

The saved routes are listed in the second column. There, you can, among other things, delete, copy, download, import from *.gpx files, or edit them. On narrow screens, this second column might not be visible - you can access it by swiping.

## WP buttons {: #wp-buttons}
When editing, but also when using a route, further options are available if you click the {{BT("NavActions",False)}} button and then {{BT("ABShowWpButtons", True)}} in "Navigation tools". 

The buttons {{BT("WpNext",False)}} and {{BT("WpPrevious",False)}} move the selection from waypoint to waypoint if working within the widget or on the map is found to be less convenient.

 Via {{BT("Edit",False)}}, each individual waypoint can be edited, for example, to assign a new name. 
 
 With {{BT("WpLocate",False)}}, you can quickly bring the selected waypoint back into the map window if the map has been moved elsewhere for any reason. This can also be done by clicking on the waypoint in the RTE widget. 

## Activating a route
Once all entries are finished, the route can be activated. This is done by clicking the start button {{BT("NavGoto",False)}}. Before doing so, check which waypoint is currently active - the route will start from there. We therefore set WP 1 as the first leg from our position and click on {{BT("NavGoto",False)}}.  

![](../../img/route-run.png)

The route becomes active, and the view jumps back to the normal navigation window. The {{BT("NavGoto",False)}} button becomes {{BT("StopNav",False)}}. This can be used to deactivate the route. You can also tell that the route is active by the fact that the direction to the WP is shown as an ochre-colored line and the widgets contain route-related values, such as the distance to the next waypoint (DST), the bearing (BRG) to it, and in the RTE widget, the length of the route and the ETA. <br><br>

The [WP buttons](#wp-buttons) also offer useful functions while sailing the route. If you decide spontaneously to skip a waypoint without wanting to change the sequence of the route, {{BT("NavNext",False)}} is the right choice: if you click it, the route jumps to the next waypoint. This can be helpful if you pass a waypoint at such a great distance that the system does not automatically acknowledge reaching it. <br><br>

The course to the next waypoint is automatically updated and displayed by default as an ochre-colored line. The course determined at the beginning of the leg is shown as a [dashed black line](./navpage.md#vectors). The {{BT("NavRestart",False)}} button performs a new initial calculation (e.g., after moving the waypoint underway) - during which XTE is reset: the dashed and the ochre-colored lines lie together again.

## Details

### Waypoint auto-advance {: #nextwp}

For automatic advance to the next waypoint in a route, two conditions must always be met:

1. The boat must be within the approach area of the waypoint. 
   The distance is set under<br>
   {{MM("MMroutepage")}} -> {{BT("ShowSettings")}} -> "Approach"<br>
   Reaching the approach area is indicated by a triggered waypoint alarm and a red display in the Route widget.

2. Depending on the mode set under <br> {{MM("MMroutepage")}} -> "Router" {{SB("Edit")}} -> "nextWpMode"
    - "late": The distance to the current waypoint no longer decreases, but the distance to the next waypoint decreases. (Default setting and older versions)  
    - "90": The waypoint is "abeam" (more precisely: the boat has crossed a line +/- 90° to the original waypoint course)  
    - "early": After the waypoint alarm, the advance occurs after an (adjustable) time without further conditions.

It is important to note that the automatic advance only occurs if both criteria (1 and 2) are met. 

If manual advance is desired, you can display the waypoint buttons at any time by clicking the widgets at the bottom left or via {{BT("NavActions")}}->{{BT("ABShowWpButtons",True)}} and use the {{BT("NavNext")}} button.  

### Route mode {: #mode }

#### [great circle](https://en.wikipedia.org/wiki/Great_circle)

Here, a route is calculated so that you have the shortest path between start and finish. The disadvantage is that the course changes constantly during the route. In the map display, such a route is not a straight line, but a curve.  
In older versions, AvNav always calculated *great circle* routes, but displayed them (incorrectly) as straight lines.  
For shorter distances (< 100nm), this is of no practical importance.

#### [rhumb line](https://en.wikipedia.org/wiki/Rhumb_line)

Here, the route is calculated so that a constant course can be steered. The map display is a straight line.

The switch is made via

{{MM("MMroutepage")}}->"Router"->{{SB("Edit")}}->"useRhumbLine" 


For the {{BT("Measure")}} tool, the mode can be set separately in the Web App settings:

{{MM("MMsettingspage")}}->"Navigation"->"Measure rhumbLine"

This allows the two paths to be easily compared.

### Disconnected mode {: #disconnected}

AvNav makes it possible to edit or change routes while a route is currently active. This allows, for example, a navigator to create and compare different alternatives while the helmsman can follow the current route undisturbed.

This is what the so-called "Disconnected" mode is for. In this mode, all route functions only take place locally on the display device (browser). In this mode, most write operations to the server are suppressed.

Via

{{MM("MMroutepage")}}->{{BT("Connected")}} 

this mode can be activated and deactivated: (1) in the image. The button is green when the mode is switched off (i.e., when routes are being edited on the server).

![Route Disconnected](../../img/routes-disconnected.png)
///caption
Route Disconnected
///

Via the {{BT("SyncRoutes")}} button (2), the routes can be [synchronized](#sync) with the server.

If "Disconnected" mode is active, this is indicated by a red icon in the title bar.

![Route Disconnected](../../img/routes-disconnected2.png)
///caption
Route Disconnected active
///

In this mode, you cannot edit routes that are stored on the server {{ICON("Server")}}. You can recognize this by the missing {{ICON("Edit")}} icon for such routes. However, you can create a copy and edit that.

In the route editor (and also during navigation), the route widget shows whether it is a local route.

![Route Lokal](../../img/routes-disconnected3.png)
///caption
Local route
///

You can start such a local route normally - and all route functions are available. However, there are the following limitations:

  * No output of RMB and APB data sets, no transfer of the route to SignalK
  * No waypoint alarm

#### Synchronizing routes {: #sync}

Via the {{ICON("Disconnect")}} icon in the title bar or via

{{MM("MMroutepage")}}->{{BT("Connected")}}

you can leave the "Disconnected" mode again. 

AvNav then compares the locally stored routes with those currently present on the server and offers synchronization.

![Routes Sync](../../img/routes-disconnected-sync.png)
///caption
Route synchronization
///

For each local route, the possible options are offered:

  * **delete**: Deletes the local route
  * **upload**: Uploads the route to the server
  * **keep local**: Keeps the local route

`upload` is only offered if the route does not exist on the server - or if `overwrite on server` has been activated.

With the {{BT("SyncRoutes")}} button, you can re-initiate this synchronization at any time.


### Combining routes

If you want to add parts of one route to another, you can do this by configuring the route from which you want to add parts as an [Overlay]() on the current map.

![Route Overlay](../../img/route-edit-overlay1.png)

Then switch to the [Route Editor](#editor), activate the point of the route (1) after which you want to insert the other route, and click on the point of the overlay route (2) from which you want to insert.

![Route Overlay 2](../../img/route-edit-overlay2.png)

After clicking on the overlay route, you can then insert the route with {{DB("DBInsertRouteAfter")}}.

![Route Overlay 3](../../img/route-edit-overlay3.png)

The points of the overlay route are then copied into the current route.