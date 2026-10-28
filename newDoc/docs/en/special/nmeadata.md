---
  tags:
    - NMEA0183
    - Sentences
---

# Nmea0183 sentences

As described in the [data flow](../base/dataflow.md) chapter, AvNav processes a series of NMEA0183 sentences. These differ slightly between the Android version and the Linux/Windows version.
In addition, AvNav also generates and outputs a few sentences itself.

**Note:** The [AvNav multiplexer](connections.md#structure) processes all NMEA0183 data - regardless of whether AvNav understands it itself.

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
* $xxVHW partial
* $xxVWR 
* $xxMTW 
* $xxZDA 
* $xxVDR  

### Sending

Depending on the [configuration](configfile.md), AvNav
can also generate NMEA data:

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
* $xxVHW partial
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