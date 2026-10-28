---
  tags:
    - Remote control
---
Remote control
==============

Starting with version 20210619, AvNav offers the option to remotely control the display on one device from another device or from the server.

This can be used, for example, if you use a device for display in the cockpit, but it is not within reach. In this case, you can use another device carried on your person - or a remote control - to switch the display on the monitor.

In addition, the Linux and Windows versions can receive remote control commands via UDP, which can then also be forwarded to connected displays.
[Plugins](plugins.md#pluginpython) can also send remote control commands.

There is a plugin for the [OpenBoat Projects IR remote control](https://github.com/wellenvogel/avnav-obp-rc-remote-plugin) by [chrhartz](https://www.segeln-forum.de/cms/user/19350-chrhartz/).
This allows this remote control to also be used for remote operation.


Functions
----------

Remote control can be used to switch pages, and on some pages, the display can be modified, e.g., the selection of the displayed dashboard page or the selection of the chart.

In the navigation view, moving the chart, centering, and zooming are transmitted.

Configuration
-------------

In total, AvNav offers 5 remote control channels. For each device, you can select which channel it should use and whether it should send or receive commands on this channel. The settings can be accessed via

{{BT("MainNav")}} -> Remote Control.

For quick enabling and disabling, the configuration can also be accessed via

{{BT("MainNav")}} -> Actions -> {{BT("RemoteChannel",True)}}.

For the remote control to work, at least one display device must be set to receive on a channel.
If the control is to be performed from another display, this must be configured to send on the same channel.

You can also set the devices to both send and receive. In this case, after a waiting period following local operation, the device automatically switches to receive mode.

In the server, the handler for the remote control must be active
(default setting: "on").


Technology
-------

Internally, every browser connects to the configured remote control channel on the server using WebSockets. On this channel, it then sends and/or receives commands depending on the configuration.

These commands are either key presses or somewhat more complex functions, e.g., for switching a page.

The commands are expected as a string, sent via UDP with a terminating newline.  
They each consist of a type and parameters.

### Key commands

A key command consists of a "K", a space, and the key code.

```
K Ctrl-  
K a
```

The keys trigger the action according to their configuration (see
[Keyboard control](keyboard.md)).

### Complex commands

These commands directly trigger specific actions in AvNav. The parameters are usually encoded in JSON.  
They are primarily intended for control from one display to another, and their format may well change.  

In principle, they look as follows:

```
CP navpage
```

In this case, the command is: *set the page to "navpage"*. A list of commands can be found in the source code under [remotechannel.ts](https://github.com/wellenvogel/avnav/blob/20bb02e6f5704b4cf5b461090051236cf867b78e/viewer/util/remotechannel.ts#L37).