---
  tags:
    - Android
    - Neigung
    - Roll
    - Pitch
    - Attitude
---

# Lage des Bootes aus dem Android-Gerät (Roll/Pitch)

Unter Android kann AvNav Roll und Pitch des Bootes aus den
Orientierungssensoren des Gerätes bestimmen - ohne externe Sensorik.
Dazu gibt es den internen Worker **InternalAttitude** (nur Android), den man
auf der [Serverseite](configfile.md#android) unter *InternalAttitude* findet.

Der Worker liest den Rotationssensor des Gerätes
(`TYPE_GAME_ROTATION_VECTOR`, Gyroskop + Beschleunigungssensor, kein
Magnetometer - die Lage ist also unabhängig vom Kurs) und gibt Roll und
Pitch einmal pro Sekunde als NMEA-XDR-Transducer aus
(`$INXDR,...,A,<wert>,D,ROLL,A,<wert>,D,PITCH`). Der Dekoder übernimmt die
Werte damit als `nav.gps.transducers.ROLL` bzw. `nav.gps.transducers.PITCH`
(Priorität 40 - höher priorisierte externe Quellen wie z.B. NMEA2000 oder
SignalK gewinnen, sofern sie diese Werte liefern).

Vorzeichenkonvention (wie SignalK / NMEA2000): positiver Roll = Steuerbord
unten, positiver Pitch = Bug oben.

## Montage und Kalibrierung

Damit Roll/Pitch stimmen, muss AvNav wissen, wie das Gerät am Boot befestigt
ist. Dafür gibt es zwei Parameter (siehe auch
[Parameterreferenz](configfile.md#android)):

* **screenFacing** - Richtung, in die der Bildschirm zeigt:
  `aft` (default, Bildschirm zum Cockpit - die übliche aufrechte Halterung
  mit Blick zum Bug), `bow`, `port`, `starboard`.
  Der Bildschirm darf dabei bis zu 60° aus der Senkrechten gekippt sein.
  **Flach aufgelegt** (Bildschirm nach oben, z.B. auf eine horizontale Fläche
  geklebt) wird *nicht* unterstützt: Dann lässt sich die Bugrichtung nicht aus
  der Bildschirmnormalen ableiten, die Kalibrierung schlägt mit "screen
  tilted too far from vertical (lying flat?)" fehl.
* **calibrateMount** - einmalig auf `true` setzen, während das Boot
  waagerecht und in Ruhe liegt. Dabei wird die exakte "Oben"-Achse des Bootes
  in Gerätekoordinaten gemessen und in *mountCalibration* gespeichert. Damit
  funktioniert jede Drehung des Gerätes in der Bildschirmebene (Hochkant,
  Querformat, ...) und auch schräge Befestigungen. Das Flag setzt sich
  automatisch zurück.

Ohne erfolgreiche Kalibrierung werden **keine Daten ausgegeben** (im Status
des Workers steht dann "not calibrated"). Nach einem Wechsel der Befestigung
oder von *screenFacing* muss neu kalibriert werden. Der Status des Workers
zeigt laufend die aktuellen Werte (`roll=... pitch=...`) bzw. Fehler an
(z.B. keine Sensordaten).

## Anzeige

Zur Anzeige eignen sich die SignalK-Widgets **signalKRoll** und
**signalKPitch** (Dashboard-Seite bearbeiten, Widget hinzufügen, im
Edit-Dialog des Widgets setzen):

* value: `nav.gps.transducers.ROLL` bzw. `nav.gps.transducers.PITCH`
* inDegree: `true` (die Werte sind in Grad, nicht Radiant)

Alternativ kann jedes Widget genutzt werden, das beliebige Keys aus dem
internen Speicher anzeigen kann, sowie alle Ausgänge, die die
XDR-Datensätze weitersenden (die $INXDR-Sätze gehen ganz normal über alle
NMEA-Ausgänge und z.B. an einen SignalK-Server).

## Hinweise

* Der Worker ist **opt-in** (default aus), da der Rotationssensor Batterie
  kostet und ein lose mitgeführtes Gerät sinnlose Werte liefern würde.
* Die Ausgabe stoppt, wenn keine Sensordaten mehr ankommen (z.B. wenn der
  Sensor nicht existiert oder ausfällt) - im Status erscheint dann ein Fehler.
