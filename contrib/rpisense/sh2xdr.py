#!/usr/bin/env python

from sense_hat import SenseHat
import time
import pynmea2

sense = SenseHat()

while 1:
  msg = pynmea2.XDR('SH','XDR', ('P',
                                 '%.4f' % (sense.pressure / 1000.),
                                 'B',
                                 'SHPRESSURE',
                                 'C',
                                 '%.1f' % sense.temp,
                                 'C',
                                 'SHTEMP',
                                 'H',
                                 '%.1f' % sense.humidity,
                                 'P',
                                 'SHHUMI'))

  print str(msg)
  time.sleep(5)


