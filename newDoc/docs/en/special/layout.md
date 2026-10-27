---
  tags:
    - Layout
    - CSS
---

# Layout Details

An introduction to layouts with a video can be found [here](../base/layout.md). This document describes some additional details about layouts.

## Formatters {: #formatter}

Most widgets require a formatter for display, which converts the internal value into the desired representation. This is usually predefined for the widget. Some formatters accept parameters to adjust their behavior (e.g., m/s instead of kn).

The parameters for a formatter are visible in the dialog with the prefix "fmt:" - "fmt:unit" in the example.  
The list of available parameters is defined in the formatter implementation (see [User
Formatters](userjs.md#formatter)).

If a formatter has a "unit" parameter, the value of this parameter is used to display it as the "unit" in the interface. Some displays allow overriding this value in the dialog.

The following formatters are available:

|  |  |  |
| --- | --- | --- |
| Name | Description | Parameters |
| formatDecimal | Simple decimal number formatting | *fix*: minimum number of integer digits. *fract*: number of decimal places *addSpace*: add a space before positive numbers *prefixZero*: add 0 as a prefix to reach the required number of integer places. |
| formatDecimalOpt | Decimal number formatting. Decimal places are only shown for non-integer values. | same as *formatDecimal* |
| formatDistance | Distance in nm|m|km | unit: nm - distance in nm, m - distance in m instead of nm, km - distance in km instead of nm |
| formatSpeed | Speed in kn|m/s|km/h | unit: kn - knots, ms - m/s instead of kn, kmh - km/h instead of kn |
| formatDirection | Format a degree value | *inputRadian*: input in rad instead of degrees, *range180*: show +/- 180° instead of 0...360°, *leadingZero*: always show 3 digits |
| formatDirection360 | Format a degree value | *leadingZero*: always show 3 digits |
| formatTime | Format a time value (internal value must be a Date) (`hh:mm:ss`) |  |
| formatClock | Format a time value (internal value must be a Date) (`hh:mm`) |  |
| formatDateTime | Format date and time (internal value must be a Date) |  |
| formatDate | Format date (internal value must be a Date) |  |
| formatString | Passes input through unchanged |  |
| formatTemperature | Format temperature (since 20210106), input in Kelvin | unit: celsius, kelvin |
| formatPressure | Format pressure (since 20210106), input in Pa | unit: pa, hpa, bar |

[Plugins](plugins.md#jscode) or custom [extensions](userjs.md) can potentially add further formatters.

## Changing System Layouts

System layouts cannot be changed directly. However, you can create a copy of these layouts and customize them. This can be done in two ways:

  1. When a system layout is currently loaded:
     Under {{MM("MMlayoutspage")}}, you can see the currently active layout in the upper "Current" section. By clicking the {{SB("Layout")}} button, you can start the layout editor via {{DB("DBEditLayout")}}.

     You will be prompted for a new name for the layout you are editing. Once a name is chosen, a copy of the system layout is created with that name, and the layout editor starts.

  2. You can click on a system layout in the list of layouts and create a copy using {{DB("DBCopy")}}. This copy can then be loaded and edited directly.


## Combined Widget {: #combinedwidget }

With the options already shown in the [introduction](../base/layout.md), you can flexibly arrange displays to your liking. Sometimes, however, you may want to break the simple multi-column layout on dashboard pages, for example, and distribute widgets across different numbers of columns. The `Combined Widget` can help you with this. It acts as a container in which you can arrange any number of "children" horizontally or vertically.

![Combined Widget](../../img/combined-widget-1.png)
///caption
Combined Widget
///

In the image, the Combined Widget was selected as a new widget, and `SOG` and `STW` were added via {{DB("DBAddSub")}}. With {{DB("DBAfter")}}, the `Combined Widget` is inserted.

![Combined Widget Inserted](../../img/combined-widget-2.png)
///caption
Combined Widget inserted
///

This allows the widgets for `STW` and `SOG` to take up only half a column width each, while the `WindGraphics` and `COG` widgets use the full width.

The `Combined Widget` is currently in the _Locked_ state - you can move it as a whole, and all contained children move with it. If you unlock the _Locked_ state in the dialog, the children can be moved individually, and you can also drag other widgets directly into it. 

In principle, you can even nest multiple `Combined Widgets` inside each other - though this can become somewhat confusing during configuration.

## CSS {: #layoutcss }

For customizations with [CSS](usercss.md), it sometimes makes sense to include them directly in a layout—this way, they only take effect when that layout is loaded. Different displays can, of course, use different layouts. For this purpose, you can use:

{{BT("LayoutFinished")}}->{{DB("DBEditCss")}}

to open a CSS editor.

![Start Layout CSS](../../img/layout-css-1.png)
///caption
Call up Layout CSS Editor
///

It is recommended to perform this call on the page where you want to see the layout adjustments. Unlike the handling of [user CSS](usercss.md), changes in the CSS take effect **only** in the current AvNav window after saving.

![Layout CSS Editor](../../img/layout-css-2.png)
///caption
Layout CSS Editor
///

As described under [user CSS](usercss.md), you can make the desired adjustments here. After saving, you can make the editor window transparent using {{DB("DBHide")}} to directly verify your CSS changes.

You can, for example, adjust the width (`--avnav-left-widgets-width`) (or height - `--avnav-horizontal-widgets-height`) of the widget containers on the navigation page—and then arrange them very flexibly using the [Combined Widget](#combinedwidget).

The CSS data is saved directly in the layout and is not visible as a separate file in AvNav.

All changes are only permanently saved when the layout is saved at the end of the editing process.

## Display Settings {: #display-settings}

There are some [settings](../base/settings.md) that may significantly influence a layout. A typical candidate is the "2 widget rows" setting under "General". This determines whether two rows of widgets are displayed at the bottom of the navigation page if there is insufficient space. If you want to prevent this for a specific layout, you can call up the settings, e.g., with

{{MM("MMsettingspage")}}

**while editing the layout** and change the desired value.

![Layout Settings](../../img/layout-settings.png)
///caption
Layout Display Settings
///

If you now save the settings with {{DB("DBOk")}}, they will be saved directly into the layout. They are then displayed in red during editing. If you click {{SB("SettingsLayoutOff")}}, the setting is removed from the layout again—and the user-selected global setting applies.

You should use this function very sparingly and only set settings directly in the layout that are absolutely necessary. Once you leave the layout editor, these settings can no longer be changed via the normal menus—only by calling up the layout editor again.

## Saving and Loading to/from the Server {: #save}

When you edit a layout, it is changed locally and also saved on the server. You have already chosen the layout name when starting the layout editor. However, it does **not** immediately take effect on all other display devices. It only takes effect there when the AvNav page is reloaded with: 

{{MMA("ReloadUI")}} 

- or the layout is explicitly selected and activated again:

{{MM("MMlayoutspage")}}

{{DB("DBActivate")}} after clicking the layout in the list.

The other display devices still have their layout stored in the browser's [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) <!--@@linkchanged-->.

If a layout is deleted on the server, the display devices will continue to work with the locally stored layout. Only if one is no longer present will they revert to the `system-default` layout.

If such a still-existing layout is edited on a display device after deletion (layout editor), it will be saved back to the server.

To back up the layouts, you can download them as a JSON file after clicking on a layout. Via {{BT("Upload")}}, you can import such a locally saved layout back into AvNav, i.e., upload it to the server.