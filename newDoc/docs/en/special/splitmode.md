---
  tags:
    - Split Mode
    - Tabs
---

# 2-Window Mode (Split Mode)

## Usage

With

{{MM("MM:actions")}}->{{BT("Split",True)}}

you can split the screen into two AvNav windows.

![2 window map](../../img/split-mode1.png)
///caption
2 window map
///

![2 window dashboard](../../img/split-mode2.png)
///caption
2 window dashboard
///

The two windows operate largely independently of each other. This allows you to place different views side-by-side as desired. In the example, you can see either two map views—even with different zoom levels—or different maps. A split between a map view and a dashboard is also possible.

Via

{{MM("MM:actions")}}->{{BT("Split",True)}}

the 2-window mode can be exited again.

The semi-transparent slider allows you to change the screen split between the windows.

## Special Features

### Alarms

In 2-window mode, alarms are only displayed in the right window.

### Settings (Display Settings)

Most [settings](../base/settings.md) apply to both windows together in 2-window mode and take effect immediately. However, some settings can be configured separately for each window. These are marked with a `*` on the settings pages.

These are in particular the settings for [remote control](remotecontrol.md).

Loading and saving settings is also performed separately for each window.

If you would like to make further settings separately for each window, you can customize the `splitkeys.json` file in the user files. You can access this via

{{MM("MMaddonconfigpage")}}

and edit it there. After making changes, you must reload AvNav in the browser.

With the setting

{{MM("MMsettingspage")}}->General->"start with last split mode"

you can ensure that AvNav starts again in split mode if it was active previously. This is particularly helpful for Android.

### Layouts

Layouts can be selected separately for each window. This allows you to design the map display differently, as shown in the example. A layout loaded in split mode does not remain active when the split mode is exited.