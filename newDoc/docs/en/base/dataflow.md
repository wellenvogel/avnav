---
  tags:
    - NMEA
    - NMEA0183
    - NMEA2000
    - Data flow
---

# Data flows

{{VIDEO("Here","dataflow")}} you can find the introductory video on the topic of "Data flows".

For a navigation software like AvNav to work, it necessarily needs data.

In this section, we will discuss which navigation data is processed by AvNav and how. It is aimed at beginners and users who want to understand and set up common scenarios for data traffic on board with AvNav.

In fact, processing data with AvNav can become a complex matter that requires profound familiarization if you want to explore the last corners and possibilities. The corresponding [articles](../special/connections.md) in the "Details" section serve this purpose.


## Data providers

Let's start with the question of which devices on board can and should generally provide navigation data for AvNav.

First of all, this would be GPS, primarily to provide position, SOG, and time. Then we receive water depth from a depth sounder, data for relative wind speed and relative wind angle from a wind sensor, and position data of other ships, which are transmitted via the AIS system.

AvNav can not only process incoming data but also output processed data again. This is particularly relevant for feeding autopilots or secondary displays.
This should describe the minimum amount of data that is assumed here for now.


## Data formats

The devices described provide their data in different formats. These are generally **NMEA0183**, **NMEA2000**, and **Seatalk**. To make the data in the various formats available for AvNav, you need hardware, more precisely so-called converters or interfaces, because depending on which computer AvNav is running on, the data must somehow reach AvNav.


## Data flow only via AvNav


### NMEA0183 via USB

Let's start with the simplest case: GPS data from a GPS mouse should reach AvNav:

We use a GPS mouse that provides NMEA0183 data. This clarifies the format. At the end of the cable, there is a USB plug. This also clarifies the interface; it is USB, i.e., a serial interface. 

On Linux systems, AvNav automatically detects when data arrives at one of the serial interfaces and sets up so-called readers via

{{MM("MMchannelspage")}}

![Screenshot](../../img/channelspage.png)

They ensure on the software side that the NMEA0183 data reaches AvNav and can be used there for navigation. 

On Android systems, the setup via an internal GPS is even easier - here too, the setup is done via

{{MM("MMchannelspage")}}


### NMEA0183 via serial converter

For a depth sounder that provides NMEA0183 data, or a marine radio that sends AIS data, things look a bit different because you will usually only find open cable ends on these devices. These devices generally operate the RS485 or RS232 interface. Like USB, these are also serial interfaces. 

As hardware, they are available as an add-on board or HAT for a Raspberry Pi or as a USB adapter. So, it gets a bit more complicated here because hardware must be installed. How to do this can be read in the documents of the respective device.


### NMEA0183 via WLAN

A third way is via a WLAN, as used for example by the open-source wind sensor “Yachta” from the Open Boat Project. However, this requires an onboard network that provides a WLAN. 

Two things are important at this point: 

First: Data in NMEA0183 format can only be transmitted directly from device to device, which means every sending device needs its own converter or an input at the receiver, i.e., the AvNav computer. Or, of course, its own network address in the network. 

And then you have to know that AvNav itself only processes NMEA0183 data. 

![Screenshot](../../img/Dataflows_nmea0183.png)


### NMEA 2000

However, nowadays so-called NMEA2000 networks are used on most recreational boats. On the so-called CAN bus used there, every connected device can be a sender and a receiver.

So, to bring an AvNav computer into such a CAN bus system, you definitely need a converter that turns data in NMEA2000 format into NMEA0183 for AvNav and vice versa.

Unlike NMEA0183, it does not matter how many devices are connected to the NMEA2000 bus.

Various types of converters are possible: Firstly, the N2K gateway developed specifically for AvNav, which converts the NMEA2000 data and sends it via WLAN and USB. With an attachable additional module, the data can also be converted to RS485. 

This hardware variant is well-suited for integrating an AvNav running on Android into an NMEA2000 network as well.

Then, converters from various other manufacturers with different functionalities can be used. 

A small overview is provided by the website of the [Open Boat Project](https://open-boat-projects.org/en/nmea2k-wlan-bridge-eine-marktuebersicht/). <!--@@linkchanged-->

CAN adapters can also be integrated, such as those found on HAT boards for Raspberry Pis or USB devices e.g., from Actisense, which do not convert to NMEA0183 themselves. The conversion to NMEA0183 and back is then carried out via additional software on the headless AvNav images, the so-called [*CanBoat*](../special/nmea2000.md).

Depending on the data format and hardware used, certain data can also leave AvNav again: Via the NMEA2000 converters and adapters, via serial interfaces or LAN and WLAN, AvNav makes NMEA0183 data available primarily for supplying an autopilot. 

Which data sets these are in detail can be found in section [Details](../special/nmeadata.md).

![Screenshot](../../img/Dataflows_nmea2k.png)

## SignalK

If you want more flexibility in handling data and, above all, want to send more than just autopilot data, a second powerful player enters the stage, which is part of the headless image: The [SignalK server](../special/signalk.md). 

It is already connected to AvNav in terms of data and can bring a lot of additional functionality to the entire system through its plugins. Unfortunately, it does not run on Android systems.

Those who want to deal with the SignalK server more intensively should read the corresponding [manuals](https://demo.signalk.org/documentation/).

Just this much regarding SignalK and AvNav, and this makes the whole thing quite complex:

AvNav and SignalK are linked via several data formats. In addition, in the interplay between AvNav and SignalK, data flows can arise that offer a lot of freedom on the one hand, but can also provoke configuration errors on the other.


## Data flow only via SignalK (OpenPlotter variant)

You can also assign all the data connections described above to the SignalK server and configure them from there. 

This is how it is done on the open-source system Openplotter. 

In that case, however, you have to live with the fact that a failure of the SignalK server also takes down the data connections to AvNav.

![Screenshot](../../img/Dataflows_signalK.png)


## Data flow via AvNav and SignalK (mixed variant)

Mixed configurations are also possible, which means you can feed some of the data directly into AvNav and another part via the SignalK server. 

This can become interesting if alarm messages are generated in the SignalK server and are to be output via AvNav. 

Likewise, apps like NodeRED or KIP, which are installed via the SignalK server, can be used for processing and displaying data. The data for this can then come from AvNav or be sent to AvNav.

![Screenshot](../../img/Dataflows_mixedFlows.png)

With such mixed systems, it is extremely important to set up the generated data flow in such a way that you do not create a roundabout - in other words, that the same data is not constantly sent back and forth between SignalK and AvNav. That would significantly slow down the overall system.

So, if you are planning something like this, you can work with filters. With filters, the sending or receiving of data can be influenced. This works both in the SignalK server and in AvNav. Therefore, you should know exactly what you are doing. 

In the [Details](../special/connections.md) section, you will find further information on configuring AvNav connections to and from onboard networks.