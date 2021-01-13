#! /usr/bin/env python3

import pyudev
import sys
import pprint
import re
import time
context=pyudev.Context()
allDev=context.list_devices(subsystem='tty')


for dev in allDev:
  if dev.parent is None or not dev.parent.subsystem == "usb-serial":
    continue
  pprint.pprint(dev)
  print("subsystem:",dev.subsystem," driver:",dev.driver," device_type:",dev.device_type," device_node:",dev.device_node," parent:",dev.parent)
  monitor = pyudev.Monitor.from_netlink(context)
  monitor.filter_by(subsystem='tty')
  #observer = pyudev.MonitorObserver(monitor, callback=print_device_event, name='monitor-observer')
  print("Enter Wait Loop")
  for deviceaction in monitor:
    action,device=deviceaction
    print('background event:',action,'device:',device)