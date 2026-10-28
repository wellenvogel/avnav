---
  tags:
    - Navigation
    - Button bar
    - Dashboard
---

# Navigation page

Part of the content in this section is also presented in the **{{VIDEO("Video here","navigation")}}**

When starting AvNav, you land immediately in the navigation view, where the last used chart is loaded. If this cannot be determined, you will be prompted to select a chart.

![Screenshot](../../img/navpage.png)

## Widgets
The program window is designed so that all relevant data and display values are quickly accessible. This is ensured by so-called "widgets". Widgets can appear at the top, bottom, and left side of the navigation page. To provide space for additional displays, there are also dashboard pages. All widgets can be freely configured to keep your preferred information in view at all times. How this works in detail and what the dashboard pages are all about is covered in the chapter on editing [layouts](layout.md).

## Button bar
In the right sidebar is the button bar, which provides the most important functions for the respective AvNav page.

| Button | Function |
| ------ | -------- |
| {{BT("MainNav",False)}} | One of the most fundamental innovations of 2026 is the ["Main Menu"](../special/mainmenu.md) in the top right, which opens an overview of the available AvNav function areas when clicked. These can be selected directly or expanded via {{ICON("MNCollapsed")}}. By expanding a function area, you can see the relevant buttons for that area, but here with longer and more descriptive text. <br><br> The "Actions" function area opens a special menu that triggers specific actions that should be reachable across all function areas. More on this [below](#actions-buttons). <br><br> Via [Settings/Main Menu](settings.md) or directly in the menu via the {{ICON("Settings")}} button, the menu can be shortened to make it more manageable for navigation tasks on the go, as many function areas are likely not needed daily. |
| {{BT("MOB",False)}} | The MOB button is always located in the same place on every page. Clicking it initially triggers a loud alarm, provided a sound-emitting device is connected to the unit. There is also a visual alarm. The current position is jumped to and clearly marked. The distance and course to the MOB are displayed in the relevant widgets. Clicking MOB again deactivates the MOB alarm. |
| {{BT("ChartsView")}} | By clicking the Charts button, previously uploaded charts can be activated. More on this in the [Charts and Overlays](charts.md) section. In addition to chart selection, AvNav offers the option to add various overlays. Overlays allow you to display additional elements in the map view alongside the pure map. These can be satellite images, previously traveled tracks, other charts, or files with buoy positions. This is particularly helpful when navigating, for example, in the border area of two charts and you do not want to keep switching charts. |
| {{BT("ZoomIn")}} {{BT("ZoomOut")}} | These are used to zoom the map section in and out. Unlike using the mouse wheel, your own boat remains centered. |
| {{BT("LockPos")}} | The Follow button ensures that the map remains fixed on the boat's position and follows it. The button gets a green border when active. The boat position can be fixed centrally (at the crosshairs) or at any point on the screen. You can set your preference in [Settings/Map](settings.md). |
| {{BT("WpGoto")}} | If you click Start, a waypoint is set at the position of the crosshairs. Information appears immediately in the widget, such as how far it is to this point, what course it can be reached on, and roughly how long it will take. This function can therefore be used to navigate quickly and effectively to a specific point, a marker, or a specific buoy, or simply to get information about the path there. However, this does not replace the route function. This means there is an approach alarm, but no automatic deactivation of the point when it is reached. That is only possible via the route function; more on this in the [Routes](routes.md) section. |
| {{BT("CourseUp")}} | This button is used to align the map orientation either to the current course of your own boat or to North. Clicking it leads to course-related alignment. The default setting is alignment to North. |
| {{BT("ShowRoutePanel",False)}} | One of the most important tools in AvNav is the route management, which can be reached with this button. It allows you to plan complex routes, set and change waypoints, and save and start routes. More on this topic in the next chapter, [Routes](routes.md). |
| {{BT("NavActions",False)}} | Another innovation in AvNav 2026 is the Tools button. It displays additional tools that are not constantly needed via a dialog. |
| {{BT("Dim",False)}} | **Android only:** The screen is dimmed to save power. This is a different function than the Night/Day function, which calls up a different color scheme. |

## Actions buttons

The buttons in the *Action* menu trigger special actions that should be reachable across all function areas.

![](../../img/actions.png)

| Button | Function |
| ------ | -------- |
| {{BT("Night",True)}} | A very dark, primarily red-toned color scheme is activated or deactivated, which is suitable for night sailing. |
| {{BT("RemoteChannel",True)}} | Allows switching the remote control channel and mode. This offers the possibility to remotely control the display of one unit from another device or from the server. This *specials* topic is explained [here](../special/remotecontrol.md). |
| {{BT("FullScreen",True)}} | If supported by the browser, this button turns full-screen mode on or off. |
| {{BT("Split",True)}} | The Split Mode can be turned on and off here. Simply put, two AvNav instances run side-by-side on the display in this mode. There are special notes and instructions [here](../special/splitmode.md). |
| {{BT("ReloadUI",True)}} | Reloads the browser window with data from the AvNav server. |
| {{BT("StatusShutdown", True)}} | If the system is running on a Raspberry image, this button starts the orderly shutdown of the system. |
| {{BT("MainExit",True)}} | **Android only:** Exits the [AvNav App](../installation/android.md) or puts it into background mode. |

## Navigation tools buttons
![Navigation Tools](../../img/navtools.png)

| Button | Function |
| ------ | -------- |
| {{BT("AnchorWatch",True)}} | With Anchorwatch, you start the internal AvNav [Anchor Watch](../special/anchorwatch.md). |
| {{BT("ABShowWpButtons",True)}} | *Show wp buttons* starts a small additional button bar that is displayed directly in the bottom right of the map view and offers additional tools related to active waypoints. |
| {{BT("CenterAction", True)}} | With *Info at Crosshair*, various pieces of information about the selected map position can be displayed. |
| {{BT("GpsCenter",True)}} | *Center Chart GPS* centers the map, visualized by the crosshairs, on the current GPS position, if available. |
| {{BT("ABShowMeasure",True)}} | With *Show Measure Buttons*, you can display a toolbox with instruments for measuring distances. This button is only active if the Follow button (see above) is not active. |

## Map displays {: #vectors}

![](../../img/vectors.png)

By default, the boat is displayed on the map as ![](../../images/Boat1.svg){ .inline-image } as soon as a GPS signal is available (the icon can be [customized](../special/usericons.md)). It indicates your position and direction of movement.

In addition, there are a number of lines: they denote distances, directions, and vectors. Here are the most important ones:

* the red circles are distance circles, by default at 300 and 1000 meters
* the red line in front of the arrow tip is the course vector to COG. Its length indicates how far you will move at the current speed within 10 minutes
* the purple line is the track - the path you have covered
* the black dashed line indicates the direction to the waypoint, which was calculated when activating route calculation or when starting to a single waypoint
* the ocher line is the direction to the active waypoint
* the dark green line represents the saved route

In [Settings / Navigation](settings.md), the parameters of these displays can be influenced and changed in many ways.

## Map objects: Feature List and Feature Info

With a click or touch on the map, additional information about objects at that location can be requested. If rough conditions make exact clicking difficult, you can also move the map so that the desired point is in the crosshairs, and then start the query using the {{BT("CenterAction", True)}} button from the *Navigation Tools*.

![](../../img/FeatureInfo-Select.png)

The displayed list contains all objects at this location for which AvNav can offer further [actions or information](../special/featureinfo.md) after selection (depending on the type). In this example, these are your own position, an AIS object, the current track, as well as the map itself.

## Dashboards

Via

{{MM("MMgpspage")}}

or by clicking on the widgets (except in the bottom left bar), you get to the dashboard pages.

![Dashboard](../../img/dashboard.png)
///caption
Dashboard
///

The displays on the dashboards can be flexibly configured via the [Layout Editor](layout.md). The image shows the "system.modern" layout.

On the dashboard pages, you can activate the [Anchor Watch](../special/anchorwatch.md) directly via the {{BT("AnchorWatch")}} button.