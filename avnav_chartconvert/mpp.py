#! /usr/bin/env python
#
# vim: ts=2 sw=2 et
#

start= 20037508.342789244 * 2 / 256 
print "start meters/pixel(level 0):",start
for i in range(1,32):
  start=start/2
  print "level(",i,"):",start


  
