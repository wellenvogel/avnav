---
  tags:
    - Layout
    - Layouteditor
---
# Layout

{{VIDEO("Here","layouts")}} you will find a video that explains the most important layout functions.

Layouts in AvNav determine how the displays ([Widgets](navpage.md#widgets)) are arranged on the navigation page and on the dashboard pages. AvNav provides predefined layouts, and you can create and customize as many additional layouts as you like. 
You can select a layout for each display device — this allows you to assemble different displays as needed.

When starting AvNav for the first time in a new browser (display device), you will be asked which layout you would like to use.

The layouts are saved as (json) files on the AvNav server (see also the [details](../special/layout.md#save) on this).

## Layout Page

To manage or edit layouts, we switch to the Layout Page.

{{MM("MMlayoutspage")}}.

![Layout Page](../../img/layoutpage.png)


Only the current, "current" layout can be edited at any time. This is shown prominently in the first line. 

At the moment, the layout *user.test* is activated. In the list below, all other saved layouts can be found.

The prefix "user" makes it clear that this is a user-created layout. Layouts with the prefix "system" are preset and cannot be edited.

[Plugins](../special/plugins.md) can also provide layouts. These can be identified by the "plugin" prefix - and are also not editable.

Via the Edit button, you can now start editing the active layout. A short dialog offers to enter a new name if it is a system layout. Otherwise, after clicking on *Edit*, the current layout will be edited.

Now, the NavPage appears slightly scaled down with a red frame to indicate that the edit mode is now activated; additionally, the button bar on the right has changed.

![Layout Editor Navigation Page](../../img/layouteditor1.png)
///caption
Layout Editor Navigation Page
///

How to use the layout editor can be seen very well in the {{VIDEO("Video","layouts")}}.

## Editing the Navigation Page {: #navpage }
Here are a few functions in brief, in case you don't want to watch the entire video.

A reminder: the focus here is only on adjusting the widgets around the map display on the navigation page or the widgets on the dashboard pages.

If you click directly on a widget, you can make changes. The most important line is likely "New Widget," as this is where you can select a different widget.

A click on the current name opens a selection list of all available widgets. 

As an example, *COG* is selected. If you click directly on "Update" now, you change the current widget that was previously selected. 

**Important:** Using the *Before* and *After* buttons, you add a new COG widget before or after the current one. The active one remains unchanged.

If you want to insert a new widget from the start, click in the empty area next to the map and you will be guided through setting up a new widget.

Further important setting options for the edited widget are (depending on the widget):

  * "Caption":
    This is the text that is visible next to the displayed value in the widget.
  * "Formatter":
    This is where the display of the value is determined together with the *Unit* line. The format is usually already predefined.

Via the line at the very top, namely "Panel", it is determined where the widget is placed on the page.
Depending on the page (navigation page/dashboard pages), there are different areas where widgets can be placed.

### Page Configuration {: #config-nav }
Via {{BT("EditPage")}}, a configuration dialog is opened.

![Layout Config](../../img/layouteditor-config-nav.png)
///caption
Layout Configuration Navigation Page
///

Here you can determine exactly which areas around the map should accommodate widgets at all. 

In addition, various conditions for the display can be set. Depending on which condition is currently true, you can place different widgets. This is useful, for example, if the anchor watch is running - then you can display the anchor watch data instead of the waypoint information (used in system layouts).

For the navigation page, two conditions are available:

  * small

    If the display device used can switch between horizontal and vertical orientation, for example, it makes sense to configure different widgets for the vertical orientation (="small" - meaning small display) than for the horizontal mode.
    The value of the screen width (in pixels) at which "small" becomes active can be set in the settings
    {{MM("MMsettingspage")}}->"General"->"portrait layout below"
    .

  * anchor

    Becomes active as soon as you activate the [anchor watch](../special/anchorwatch.md).

While you are working in the layout editor, these conditions are **not automatically** set - i.e., rotating the display does not activate the "small" mode. To activate the conditions, you must use the configuration dialog.

Under "Panel Configurations" you will find the list of available panels that can accommodate widgets. The checkmarks indicate whether the panel is displayed in the mode. The gray background indicates whether the panel has its own configuration for the mode.

In the example image, this means:

  1. Condition "anchor" is active, "small" is inactive
  2. Panel "left" and "bottomLeft" have a separate configuration for the condition
  3. Panel "top" is not displayed
  4. Panel "bottomRight" has no special configuration - i.e., the configuration without conditions is used

When the configuration is finished, you can leave the dialog with {{DB("DBOk")}}. 

**Note:** Depending on the selected conditions, you are now editing the panels for these conditions!

### Moving Widgets

You can move widgets using drag and drop in the layout editor. This works both within a panel and between them.

### Undo

With the {{BT("RevertLayout")}} button, you can undo the last changes step by step.

## Dashboard Pages

Via 
{{MM("MMgpspage")}} 
you switch to the dashboard pages in the layout editor. Editing the widgets is identical to the editing on the [navigation page](#navpage).

### Page Configuration {: #config-gps}

Via {{BT("EditPage")}}, the configuration dialog is opened again.

![Page Configuration](../../img/layouteditor-config-gps.png)
///caption
Page Configuration Dashboard
///

The condition handling is carried out as on the [navigation page](#config-nav). However, only the "anchor" condition is supported on the dashboard pages.

In the configuration dialog, you can also specify texts for the button that opens the current dashboard page. The "button short text" is displayed on the button (max. 7 characters), the "button long text" as a tooltip or in the main menu. These texts are also saved in the layout.

In the default layout, 5 dashboard pages are available. Pages without widgets do not appear as a button outside the layout editor.

You can increase this number up to 10:

{{MM("MMsettingspage")}}->"General"->"number of dashboards".

If this setting is to be saved in the layout, you must make it in the layout editor mode (see [details](../special/layout.md#display-settings)).

## Exiting the Editor

With the {{BT("LayoutFinished")}} button, editing the layout is finished.

![Exit Layout Editor](../../img/layouteditor-finish.png)
///caption
Exit Dialog
///

You can decide here once more to discard all changes made. With {{DB("DBOk")}}, the layout is saved on the server and also activated locally.

The use of {{DB("DBEditCss")}} is described in the [details](../special/layout.md#layoutcss).

## Further Details

Some special notes on the layouts - including importing and exporting - can be found [here](../special/layout.md).