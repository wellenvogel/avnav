---
  tags:
    - NMEA0183
    - Sentences
---

# NMEA0183 Sentences

As described in the chapter [Data flow](../base/dataflow.md), AvNav processes a range of NMEA0183 sentences. These differ slightly between the Android version and the Linux/Windows version.
In addition, AvNav also generates and outputs a few sentences itself.

**Note:** The [AvNav Multiplexer](connections.md#structure) processes all NMEA0183 data - regardless of whether AvNav understands them itself.

## Linux/Windows

### Receiving

* !AIVDM (AIS data)
* $xxGGA
* $xxGSV
* $xxGLL
* $xxGSA
* $xxVTG
* $xxRMC 
* $xxMWV
* $xxMWD 
* $xxDPT
* $xxDBT
* $xxDBK
* $xxDBS
* $xxXDR 
* $xxHDG 
* $xxHDT 
* $xxHDM 
* $xxVHW partially
* $xxVWR 
* $xxMTW 
* $xxZDA 
* $xxVDR  

### Sending

Depending on the [configuration](configfile.md), AvNav can also generate NMEA data:

* $GPRMB
* $GPAPB
* $GPRMC (if canboat is used)
* $AVXDR
* $AVMDA
* $AVMTA

## Android
### Receiving

* !AIVDM (AIS)
* $xxGSV
* $xxGSA
* $xxMWV
* $xxMWD
* $xxVWR
* $xxDPT
* $xxDBT
* $xxGLL
* $xxGGA
* $xxRMC
* $xxDBT
* $xxMTW 
* $xxXDR 
* $xxHDM 
* $xxHDT
* $xxVDR
* $xxVHW partially
* $xxHDG
* $xxVTG
* $xxVWR 
* $xxZDA
* $xxGNS

## Sending

* $GPRMB (if activated in the router)
* $GPAPB (if activated in the router)
* $xxGSV (if *internalGPS* is activated)
* $xxGSA (if *internalGPS* is activated)
* $xxGGA (if *internalGPS* is activated)
* $xxRMC (if *internalGPS* is activated)