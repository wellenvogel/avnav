#!/usr/bin/env python

from sense_hat import SenseHat
import time
import pynmea2

sense = SenseHat()

while 1:
  msg = pynmea2.MDA('SH','MDA', ('%.4f' % sense.pressure * 29.5301/1000,
                                 'I',
                                 '%.4f' % sense.pressure / 1000,
                                 'B',
                                 '%.1f' % sense.temp,
                                 'C',
                                 '',
                                 'C',
                                 '%.1f' % sense.humidity,
                                 '','','C','','T','','M','','N','','M'))
  print str(msg)
  time.sleep(5)


