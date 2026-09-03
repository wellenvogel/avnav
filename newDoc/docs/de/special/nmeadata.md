---
  tags:
    - NMEA0183
    - Sentences
---

# NMEA0183 Datensätze

Wie im Kapitel [TODO](TODO datenfluss) beschrieben, verarbeitet AvNav eine Reihe von NMEA0183 Datensätzen. Diese unterscheiden sich minimal zwischen der Android Variante und der Linux/Windows Variante.
Daneben erzeugt AvNav auch einige (wenige) Datensätze selbst und gibt sie aus.

**Hinweis:** Der [AvNav Muliplexer](TODO: struktur, muliplexer) verarbeitet alle NMEA0183 Daten - uanbhängig davon, ob AvNav selbst sie versteht.

## Linux/Windows

### Empfang

* !AIVDM (AIS Daten)
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
* $xxVHW partiell
* $xxVWR 
* $xxMTW 
* $xxZDA 
* $xxVDR  

### Senden

Je nach [Konfiguration](configfile.md) kann AvNav
auch NMEA-Daten erzeugen:

* $GPRMB
* $GPAPB
* $GPRMC (falls canboat genutzt wird)
* $AVXDR
* $AVMDA
* $AVMTA

## Android
### Empfang

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
* $xxVHW partiell
* $xxHDG
* $xxVTG
* $xxVWR 
* $xxZDA
* $xxGNS

## Senden

* $GPRMB (wenn im Router aktiviert)
* $GPAPB (wenn im Router aktiviert)
* $xxGSV (wenn internalGPS aktiviert ist)
* $xxGSA (wenn internalGPS aktiviert ist)
* $xxGGA (wenn internalGPS aktiviert ist)
* $xxRMC (wenn internalGPS aktiviert ist)


