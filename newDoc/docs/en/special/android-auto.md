---
  tags:
    - Android
    - AndroidAuto
---

# AvNav on Android Auto

For using AvNav on a boat, you typically need a display that is as bright as possible ("sunlight-readable") and at least 8 inches in size. Due to the increasing prevalence of modern navigation and entertainment systems in cars, there are more and more affordable displays (< €100) that offer high brightness and are intended for use in cars. These displays often do not have their own navigation or display software but rely on [Android Auto](https://en.wikipedia.org/wiki/Android_Auto) <!--@@linkchanged--> or [Apple CarPlay](https://en.wikipedia.org/wiki/CarPlay).

This requires a corresponding mobile device (Android or iOS) with the appropriate software. The displays usually support a connection via USB - and in newer versions, also via Bluetooth and Wi-Fi.

Since there is also an Android version of AvNav, it can be set up for display on an Android Auto-capable screen. You can then leave the mobile device protected in the cabin, and only the display needs to be visible and accessible from the outside if necessary.

How to do this is described here.

## Prerequisites

[Android Auto](https://play.google.com/store/apps/details?id=com.google.android.projection.gearhead&hl=en) <!--@@linkchanged--> must be installed on the mobile device—this is usually pre-installed on modern devices.

Additionally, an app intended to be used under Android Auto must be prepared accordingly.
Google sets strict standards for which apps are allowed to use Android Auto and with which functions.

An app like AvNav cannot directly comply with these standards, but the following describes how you can use it regardless.

The solution described below requires a mobile device with at least Android 15.

## Preparations

The work described here must be performed once to prepare for use.

Since AvNav itself cannot run directly under Android Auto, the server function of AvNav is used. This means you only need a browser that is capable of running under Android Auto.

For this, there is [AABrowser](https://github.com/kododake/AABrowser). Since it is not available in the Play Store, you must download the APK directly from the [GitHub Release page](https://github.com/kododake/AABrowser/releases/) and then install it on your mobile device. To do this, you must allow installation from unknown sources.

As also described on the GitHub page, you must additionally allow the use of apps that do not meet the strict Google standards in Android Auto on your mobile device.

To do this, open Android Auto on your mobile device and activate developer mode by tapping "Version" 10 times.

![AndroidAuto developer mode](../../img/android-auto-cfg.png)

Via the menu (3 dots), go to the developer settings and activate "Unknown sources".

![Android Auto unknown sources](../../img/android-auto-cfg2.png)

Afterwards, you can ensure that AABrowser appears in the Android Auto launcher via "Customize launcher" in Android Auto.

This completes the first part—if you now connect the mobile device to the Android Auto display, you can open the AABrowser there.

Now, a bookmark for AvNav is created in the AABrowser to be able to open the display quickly.

To do this, start AvNav and check once more if the web server is active under {{MM("MMserverpage")}}.

Afterwards, you can send AvNav to the background (do not terminate it!) via {{MM("MM:actions")}}-> {{BT("MainExit",True)}}.

Now open the AABrowser directly on the mobile device and enter the address `http://127.0.0.1:8080` (the port must, of course, match the port set up in the AvNav web server—8080 is the default). AvNav should now be displayed.

![AABrowser AvNav](../../img/android-auto-aa1.png)

Via the menu button of the AABrowser, you can now set up this page for startup.

First, create a bookmark for the page ("Bookmarks").

![AABrowser Bookmark](../../img/android-auto-aa2.png)

In the image, the bookmark has already been created; otherwise, you must first click "Add". Using the pin button, add this bookmark to a so-called "Slot"—this is a list of bookmarks that are displayed directly on the start page.

Afterwards, you can exit the AABrowser and restart it to test it. The browser always remembers the last displayed page and will thus normally open AvNav directly again.

The display of the AABrowser menu button can be turned off by switching to full-screen mode in AvNav:

{{MM("MM:actions")}}-> {{BT("FullScreen",True)}}

## Normal Use

To use AvNav in this configuration, you must start AvNav once after starting the mobile device and send it back to the background. Unfortunately, Google's privacy settings forbid the automatic start of software that wants to access location data, making this manual step necessary.

However, some mobile devices or other apps offer functions to automatically start certain apps—in this case, you can also start AvNav automatically.

After that, you can connect the mobile device to the display (this should normally happen automatically) and start the AABrowser on the display.

### Automatic start on Samsung

Samsung mobile devices offer a very convenient way with [Modes and Routines](https://www.samsung.com/en/support/mobile-devices/modes-and-routines/) <!--@@linkchanged--> to, for example, start an app when you connect to an Android Auto display.

To do this, you must create a routine that has "Connect to Android Auto" as a condition and the starting of an app—AvNav—as an action. This is done with a few clicks. This will start AvNav automatically when Android Auto is connected.

### Other mobile devices

If the mobile device itself does not offer such an automation possibility, you can use an app like [MacroDroid](https://wiki.macrodroid.com/wiki/index.php?title=MacroDroid_Wiki) or [Tasker](https://tasker.joaoapps.com/).

## Safety Note

For the described use case, using the AABrowser on a display is not a danger.

**However, if you also use the same mobile device in a car and connect it to the display there, the use of the AABrowser is definitely not permitted. It is therefore the responsibility of the user to observe this.**