#! /usr/bin/env python3

import math
import sys
import re
import xml.etree.ElementTree as ET
def deg2num(lat_deg, lon_deg, zoom):
  lat_rad = math.radians(lat_deg)
  n = 2.0 ** zoom
  xtile = int((lon_deg + 180.0) / 360.0 * n)
  ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
  return (xtile, ytile,zoom)

def num2deg(xtile, ytile, zoom):
    n = 2.0 ** zoom
    lon_deg = xtile / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * ytile / n)))
    lat_deg = math.degrees(lat_rad)
    return (lat_deg, lon_deg)

class Bbox:
    def __init__(self,fname,zoom,minx,maxx,miny,maxy) -> None:
        self.fname=fname
        self.zoom=int(zoom)
        self.minx=int(minx)
        self.maxx=int(maxx)
        self.miny=int(miny)
        self.maxy=int(maxy)
    
    def contains(self,zoom,x,y):
        if self.zoom != zoom:
            return False
        return x >= self.minx and x <= self.maxx and y>= self.miny and y <= self.maxy


def parseLog(logName):
    rt=[]
    with open(logName,"r") as h:
        for l in h:
            if not re.match(".*FillInfo.*",l):
                continue
            l=l.rstrip()
            l=re.sub(".*FillInfo *","",l)
            fn=re.sub(":.*","",l)
            zoom=re.sub(".*zoom= *","",l)
            zoom=re.sub("[^0-9].*","",zoom)
            box=re.sub(".*\\<BoundingBox","<BoundingBox",l)
            box=re.sub("\\</BoundingBox\\>.*","</BoundingBox>",box)
            root=ET.fromstring(box)
            bbox=Bbox(fn,zoom,root.get('minx'),root.get('maxx'),root.get('miny'),root.get('maxy'))
            rt.append(bbox)
    return rt        



if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("usage: %s tn lat lon zoom"%sys.argv[0])
        print("       %s tc x y zoom"%sys.argv[0])
        print("       %s parse logfile"%sys.argv[0])
        print("       %s search logfile lat lon zoom [up] [down]")
        sys.exit(1)
    mode=sys.argv[1]
    if mode == "tc":
        x=int(sys.argv[2])
        y=int(sys.argv[3])
        z=int(sys.argv[4])
        nw=num2deg(x,y,z)
        se=num2deg(x+1,y+1,z)
        center=num2deg(float(x)+0.5,float(y)+0.5,z)
        print("NW: lat=%3.8f, lon=%3.8f"%nw)
        print("SE: lat=%3.8f, lon=%3.8f"%se)
        print("CT: lat=%3.8f, lon=%3.8f"%center)
        sys.exit(0)
    if mode == "tn":    
        tile=deg2num(float(sys.argv[2]),float(sys.argv[3]),int(sys.argv[4]))
        print("x=%d,y=%d,z=%d"%(tile[0],tile[1],tile[2]))
        sys.exit(0)
    if mode == "parse":
        parseLog(sys.argv[2])
        sys.exit(1)
    if mode == "search":
        logf=sys.argv[2]
        lat=float(sys.argv[3])
        lon=float(sys.argv[4])
        zoom=int(sys.argv[5])
        up=0
        if len(sys.argv) > 6:
            up=int(sys.argv[6])
        down=0
        if len(sys.argv) > 7:
            down=int(sys.argv[7])
        tileList=[]
        tileList.append(deg2num(lat,lon,zoom))
        for i in range(1,up):
            tileList.append(deg2num(lat,lon,zoom+i))
        for i in range(1,down):
            z=zoom-i
            if z >= 0:
                tileList.append(deg2num(lat,lon,z))
        print("searching for tiles(x,y,z):")
        for t in tileList:
            print("%d\t%d\t%d"%(t[0],t[1],t[2]))
        boxList=parseLog(logf)
        for box in boxList:
            for t in tileList:
                if box.contains(t[2],t[0],t[1]):
                    print("%d\t%d\t%d\t%s"%(t[0],t[1],t[2],box.fname))
        sys.exit(0)            
    print("invalid mode %s"%mode)
    sys.exit(1)        
