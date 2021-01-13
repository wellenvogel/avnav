#! /usr/bin/env python3
#
# vim: ts=2 sw=2 et
#

import sys
#from wx.py.crust import Display

inchpm=39.3700
dpi=100
if len(sys.argv) >1:
  dpi=int(sys.argv[1])

displaympp=1/(float(dpi)*inchpm)

print("display mpp=%f"%(displaympp))  

mpp= 20037508.342789244 * 2 / 256 
print("Level    :   mpp     \t\t: scale")
for i in range(0,31):
  scale=mpp/displaympp
  print("level(%02d):%07.4f:\t\t1:%5.2f"%(i,mpp,scale))
  mpp=mpp/2


  
