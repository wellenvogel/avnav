---
  tags:
    - Charts
---
# Charts

{{VIDEO("Here","charts")}} you will find an introductory video on the topic of "Charts" in AvNav.

## Formats {: #formats}

AvNav supports various chart formats, for example:

### Raster charts
  Formats: GEMF, MBTiles and PMTiles
  
  Freely available raster charts 
  can be obtained, among others, from OpenSeaMap and FreeNauticalChart. 
  Raster charts from various sources can also be created yourself and uploaded to AvNav or generated with the Mapproxy app. Further details can be found in the [Details](../special/charts.md).
  Using the [Mobile Atlas Creator](https://mobac.sourceforge.io/) tool, maps from various online sources can be downloaded and then installed in AvNav. Notes on this can be found under [Mobile Atlas Creator](../special/mapsources.md).
  You can also find other tools on the internet that enable the downloading of charts.

### Vector charts

AvNav primarily uses vector charts from *O-Charts* with the appropriate [PlugIn](../special/ochartsng.md). 
  With O-Charts, all common sea areas in Europe can be covered at affordable prices. They are based on the official charts of the respective countries and contain all the information required for navigation on pleasure craft. Unfortunately, the O-Charts do not run on Windows systems.
  
  In addition, vector charts of inland waterways in iENC format and vector charts from NOAA can be downloaded for free.

### Online chart sources
  These charts require an internet connection. This would be, 
  for example, OpenSeaMap in the online version without prior download.

### Plugins
  With corresponding plugins, additional chart formats, such as 
  vector tiles, can be used. This, however, requires some preparatory work. In the [Details](../special/charts.md#insertingdefs) you will find further support on this.

## Management {: #management}

With the installation of AvNav, some charts, e.g., from the BSH or OpenSeaMap, are already provided. You can access the overview of existing charts directly from the navigation page via the {{BT("NavSelectChart")}} button. Using the Select Charts dialog, you can see all already installed charts.

In the area 

{{MM("MMchartspage")}}

you can manage the charts.

![Charts page](../../img/chartspage.png)
///caption
Charts page
///

Here, too, you can see the already installed charts in the "Charts" column. 

Via "Upload File" {{SB("Upload")}} in this column, you can upload charts in the supported formats to the AvNav server.

The "Import" column is intended for charts that need to be converted beforehand. How this process works in detail can be read in the [Details](../special/charts.md#converter). 

And the right column “Overlays” is described in a separate [chapter](overlays.md).

In the button bar at the bottom, you can see the OC-NG button 
![](../../img/icon-ochartsng.svg){: .inline-image }.

It is responsible for the installation of O-Charts. The installation of O-Charts is shown in the {{VIDEO("Video","charts")}}, and for further reading, you can use the [detailed documentation](../special/ochartsng.md).



## Links
* [Details on charts and chart types](../special/charts.md)
* [Mobile Atlas Creator Sources](../special/mapsources.md)