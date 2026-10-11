---
  tags:
    - Maps
---
Mobile Atlas Creator Mapsources {: #Mobac}
==========================================

2022/04/17  
Adjustments for mobac 2.2.2

2021/08/22  
Adjustments for mobac 2.2x, adaptation to new BSH layers

2020/01/26  
Yet another few small modifications to the map sources so that access to the BSH servers works again.

Sources
-------

For the [Mobile Atlas Creator](https://mobac.sourceforge.io/),
I have created several map sources that allow for more flexible definition of access to map services via XML. To use them, unzip the file [avnav-mapsources.zip]({{DLLINK("avnav-mapsources.zip")}}) into the "mapsources" directory of the Mobile Atlas Creator.   
For Mobac version 2.2.1, please use the file [avnav-mapsources-before222.zip]({{DLLINK("avnav-mapsources-before222.zip")}}).  
For Mobac versions < 2.2.1, please use the file [avnav-mapsources-before22.zip]({{DLLINK("avnav-mapsources-before22.zip")}}).

This provides, among others, a "mashUp" of the BSH map services - see also [bsh-viewer]({{HPLINK("../bshviewer/bshviewer.html")}}) and OpenSeaMap
("BSH OpenSeaMap 2021 Extended"). Furthermore, BSH alone ("BSH 2021
Extended") or OpenSeaMap + OpenStreetMap ("OWS OpenSeaMap 2021") are available. If anyone wants to "play around," you can adjust the .exml files accordingly.
The layers for the BSH query are particularly interesting. You can test them with
my [bsh-viewer]({{HPLINK("../bshviewer/bshviewer.html")}})
(edit the source on the right side in each case). Additionally, you can adjust the colors if needed - I tried to create a bit more contrast. If you want to change something - open one of the maps with, for example, paint.net, select the hex values for the colors, and enter them in the .exml file.

The download usually takes quite a while - often the BSH server is very
slow or prone to crashing. In that case, simply try again (to do this, set the cache settings in Mobac so that it keeps the maps in the cache for, e.g., 1 month) - eventually, they will all be downloaded. Always choose "OsmdroidGEMF" as the format now (this can also be used in other programs, by the way...).

If you make changes to the exml files (especially to the layers), you must delete the corresponding caches under "Tilestore" - otherwise, the changes will not take effect.

Source files are on [github](https://github.com/wellenvogel/avnav/tree/master/mobac/testsrc).

The result looks like this, for example (this is the entrance to Greifswald):

![](../../img/MobacExampleBsh.PNG)

Here are the files again:

* [avnav-mapsources.zip]({{DLLINK("avnav-mapsources.zip")}})
  (the mapsources BSH, BSH+OpenSeaMap)