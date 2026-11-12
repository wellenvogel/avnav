---
  tags:
    - Android
    - Attitude
    - Roll
    - Pitch
---

# Boat attitude from the Android device (roll/pitch)

On Android, AvNav can determine the boat's roll and pitch from the device's
orientation sensors - without any external sensor hardware. For this there
is the internal worker **InternalAttitude** (Android only), which can be
found on the [server page](configfile.md#android) under *InternalAttitude*.

The worker reads the device's rotation sensor
(`TYPE_GAME_ROTATION_VECTOR`, gyroscope + accelerometer, no magnetometer -
so the attitude does not depend on the heading) and emits roll and pitch
once per second as NMEA XDR transducers
(`$INXDR,...,A,<value>,D,ROLL,A,<value>,D,PITCH`). The decoder picks these up
as `nav.gps.transducers.ROLL` and `nav.gps.transducers.PITCH`
(priority 40 - higher priority external sources like NMEA2000 or SignalK win
if they provide these values).

Sign convention (same as SignalK / NMEA2000): positive roll = starboard side
down, positive pitch = bow up.

## Mounting and calibration

For correct roll/pitch, AvNav needs to know how the device is mounted on the
boat. There are two parameters for this (see also the
[parameter reference](configfile.md#android)):

* **screenFacing** - the direction the screen faces:
  `aft` (default, screen towards the cockpit - the usual upright mount with
  the viewer facing the bow), `bow`, `port`, `starboard`.
  The screen may be tilted up to 60° away from vertical.
  **Lying flat** (screen facing up, e.g. taped onto a horizontal surface) is
  *not* supported: the bow direction cannot be derived from the screen normal
  then, and calibration fails with "screen tilted too far from vertical
  (lying flat?)".
* **calibrateMount** - set to `true` once while the boat is level and at rest.
  This measures the exact boat up axis in device coordinates and stores it in
  *mountCalibration*. This makes any rotation of the device in the screen
  plane work (portrait, landscape, ...) as well as tilted mounts. The flag
  resets automatically.

Without a successful calibration **no data is emitted** (the worker status
then shows "not calibrated"). Recalibrate after changing the mount or
*screenFacing*. The worker status continuously shows the current values
(`roll=... pitch=...`) or errors (e.g. no sensor data).

## Display

The SignalK widgets **signalKRoll** and **signalKPitch** are suitable for
display (edit the dashboard page, add the widget, and in the widget's edit
dialog set):

* value: `nav.gps.transducers.ROLL` or `nav.gps.transducers.PITCH`
* inDegree: `true` (the values are in degrees, not radians)

Alternatively, any widget that can display arbitrary keys from the internal
store can be used, as well as all outputs that forward the XDR sentences (the
$INXDR sentences go out via all NMEA outputs and e.g. to a SignalK server).

## Notes

* The worker is **opt-in** (default off) because the rotation sensor costs
  battery and a loosely carried device would produce meaningless values.
* Emission stops when no more sensor data arrives (e.g. if the sensor does not
  exist or fails) - the status then shows an error.
