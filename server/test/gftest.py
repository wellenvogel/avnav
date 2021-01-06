import urllib.request, urllib.error, urllib.parse
import xml.etree.ElementTree as ET

BBOX =(54.204223304732,13.408813476562,54.207436119875,13.414306640625)
fact=5

#str="https://www.geoseaportal.de/wss/service/NAUTHIS_AidsAndServices/guest?CRS=EPSG:4326&SERVICE=WMS&QUERY_LAYERS=11,13,14,15,20,34,35,36,41,53,55,56,57,74,76,77,78,83,97,98,99,116,118,119,120&&VERSION=1.3.0&REQUEST=getFeatureInfo&INFO_FORMAT=text/xml&BBOX=54.188155481072,13.4033203125,54.213861000645,13.447265625,&WIDTH=256&HEIGHT=256&X=%d&Y=%d"
str="https://www.geoseaportal.de/wss/service/NAUTHIS_AidsAndServices/guest?CRS=EPSG:4326&SERVICE=WMS&QUERY_LAYERS=11,13,14,15,20,34,35,36,41,53,55,56,57,74,76,77,78,83,97,98,99,116,118,119,120&&VERSION=1.3.0&REQUEST=getFeatureInfo&INFO_FORMAT=text/xml&BBOX=%f,%f,%f,%f,&WIDTH=%d&HEIGHT=%d&X=%d&Y=%d"

def matrix(a,b,c,d,e,f):
  sz=10
  return (a*sz+c*sz+e,b*sz+d*sz+f)

diffy=(BBOX[2]-BBOX[0])/fact
diffx=(BBOX[3]-BBOX[1])/fact
diffy=diffx
pix=256//fact
step=int(pix/10)
print("fact:",fact)
print("sz:",pix)
for loop in range(0,fact):
  for loopy in range(0,fact):
    bbox2=(BBOX[0]+loop*diffx,BBOX[1]+loopy*diffy,BBOX[0]+(loop+1)*diffx,BBOX[1]+(loopy+1)*diffy)
    print("loop:",loop)
    print("loopy:",loopy)
    print("BBOX:",bbox2)
    for x in range(0,pix,step):
      print("###",x)
      for y in range(0,pix,step):
        url=str%(bbox2+(pix,pix,x,y))
        response = urllib.request.urlopen(url)
        html = response.read()
        tree = ET.fromstring(html)
        for child in tree:
          print(x,y,bbox2[0]+float(x)/float(pix)*diffx,bbox2[3]-float(y)/float(pix)*diffy, child.tag, child.attrib)
    #    print x,y, tree

