---
  tags:
    - Nmea2000
    - SignalK
---
Interaction with SignalK
==========================


![SignalK](../../img/SignalK.png)

## SignalK data in AvNav
The Raspberry, Linux, and Windows versions of AvNav can directly receive data from [SignalK](https://signalk.org/en/) <!--@@linkchanged--> and send data there as well.

All versions of AvNav can receive NMEA0183 data from [SignalK](https://signalk.org/en/) <!--@@linkchanged--> and send it there.

There are various options for how data from SignalK is processed and used in AvNav.

### NMEA0183 data
This data passes through the standard [multiplexer](connections.md#structure) and [decoder](connections.md#structure) in AvNav. The decoded data can be used for navigation and display - just like any other received NMEA data.

Since AvNav also provides all NMEA data to interfaces (TCP, UDP, serial, etc.), data can also be sent to SignalK in this way.

### Direct SignalK data
In the Raspberry, Linux, and Windows versions, AvNav can also directly use the interfaces of the SignalK server to receive and send data. AvNav includes a SignalK handler for this purpose, which can be [configured](#configuration). It can be accessed via 

{{MM("MMchannelspage")}} -> SignalKHandler

The received data can be used in various ways depending on the configuration:

1.  "decodeData" switched off:
    All SignalK data from `vessels.self` (own vessel) is provided in AvNav as __additional__ data under `nav.gps.signalk...` and can only be used in [displays](../base/layout.md). It cannot be used for navigation. This only makes sense, of course, if the data required for navigation reaches AvNav through other [channels](#dataflow).
    {: #addon}

2. "decodeData" switched on:
   The SignalK data is additionally used for navigation and [mapped](#mapping) to the corresponding data in AvNav. 
   {: #decode}

For further details, see [configuration](#configuration).

## Data flow {: #dataflow}
Depending on user preferences and existing system configurations, there are several ways data can flow between AvNav and SignalK. To avoid problems, especially loops where data comes from SignalK and is then sent back there via another path, you should decide on a fundamental data flow:

1. NMEA data first arrives in AvNav and is then forwarded from there to SignalK. This setup is used in the [AvNav Headless Images](../installation/raspberry.md#images). 
   SignalK data not yet present in AvNav, e.g., from sensors, can be sent back to AvNav as [additional data](#addon) via the SignalK handler and then displayed there.  
   The data that AvNav uses for navigation (including AIS data) is decoded here directly by AvNav from the NMEA data.  
   NMEA2000 data will normally always be sent directly to SignalK so it can be decoded there directly. AvNav can receive this data via [Canboat](nmea2000.md) - or obtain it from SignalK. However, if you do this, you create a mixed data flow and must ensure you do not create loops.

2. NMEA data first arrives in SignalK and can be forwarded from there to AvNav via the [SignalK handler](#decode).  
   This is the setup used, for example, in OpenPlotter.

For both variants, AvNav can also send its own data to SignalK. At the moment, this includes routing data to the next waypoint, either as RMB/APB NMEA0183 data or as a SignalK update - see below.

Additionally, notifications (alarms) from SignalK can be read and sent there.


### 1. NMEA to AvNav and from there to SignalK {: #flow1}

The configuration is prepared in the [AvNav Headless Images](../installation/raspberry.md#images).

For this configuration, an AVNSocketWriter is provided in AvNav, which forwards received NMEA data (default port: 34568). Through blacklist entries, data from *canboat* (NMEA2000) is not transmitted.

```
<AVNSocketWriter port="34568" maxDevices="5" filter="" read="true" minTime="50" name="nmea0183tosignalk" blackList="canboatnmea0183,canboatgen"/>
```

In SignalK, a corresponding *Data Connection* for NMEA0183 as a TCP client to port 34568 must be created (already set up in the images).

The AVNSignalKHandler is configured by default to reach SignalK via the address *localhost:3000* and reads all data from *vessels.self*. These are then saved in AvNav under *gps.signalk. ...* and can thus be used in [displays](../base/layout.md).  
A mixture of polling via HTTP-JSON and a WebSocket connection is used. The polling ensures a secure update, while the WebSocket connection provides a real-time update.

On the above SocketWriter connection, AvNav also sends its routing data as RMB or APB sentences to SignalK.  
Additionally, the integration of alarms (SignalK: notifications) can be activated in the SignalK handler.

Data that arrives directly in SignalK via other paths is forwarded to AvNav as described, but **is not directly usable there for navigation**.

If you want data to arrive in SignalK first and then go to AvNav, you should consider whether the other signal flow (2) is more suitable.

The advantage of signal flow 1 (NMEA to AvNav first) is that the navigation functions of AvNav can still work even if SignalK is unavailable or causing issues.

### 2. NMEA data to SignalK first {: #flow2}

In this signal flow, which is the default in OpenPlotter (from AvNavInstaller version xxxx), NMEA data is first received and stored in SignalK. For this, the corresponding *Data Connections* must be configured in SignalK.

In AvNav, the AVNSignalKHandler is configured to retrieve data from SignalK in a combination of HTTP-JSON and a WebSocket connection.  
The flags "decodeData" and "fetchAis" (see [configuration](#configuration)) are set. This means received data is stored internally in AvNav for navigation. Additionally, as in [(1)](#flow1), they are stored under gps.signalk.... so that displays function exactly the same.  
For the mapping of data, see [[Mapping](#mapping)].

In the AVNSignalKhandler, sending data is also activated ("sendData"). Data for the current waypoint as well as alarms are sent to SignalK.  
Additionally, notifications from SignalK are received.  
To write data to SignalK, a user with write permissions available in SignalK must be configured (see [configuration](#configuration)).


### Selecting the data flow

To decide whether [data flow 1](#flow1) (first to AvNav) or [data flow 2](#flow2) (first to SignalK) should be used, one can generally start with the defaults based on the system you are using.

One should only deviate from this if there are good reasons.
By configuring on the page ({{BT('MainNav')}} -> Connections/Devices), you can set up either of these flows; mixed forms are even possible.

You only need to ensure that you do not create loops - e.g., sending data from AvNav via NMEA0183 to SignalK and then retrieving it back from there.  
AvNav tries to avoid such problems with a "sourcePriority" on every connection. All NMEA connections have a default priority of "50", and the AVNSignalKHandler has "40" - thus, directly received NMEA data always "wins" over data fetched from SignalK.

## Configuration {: #configuration}

The AVNSignalK handler has the following configurations.

|  |  |  |
| --- | --- | --- |
| Name | Description | Default |
| name | A name for the handler. Displayed on the status page and used in the log. | empty (signalk) |
| enabled | If disabled, the SignalK integration is deactivated. Any configured NMEA connections are not affected. | on |
| decodeData | If switched on, the data received from SignalK is also used for navigation functions in AvNav. See [Mapping](#mapping). | off (on on OpenPlotter) |
| fetchAis | If switched on, AIS data is fetched from SignalK every 10s (aisQueryPeriod) and stored in AvNav as AIS data. | off (on on OpenPlotter) |
| priority | The priority of the decoded SignalK data | 40 |
| port | The SignalK HTTP port. | 3000 |
| host | The SignalK server hostname/IP address. | localhost |
| aisQueryPeriod | Interval (in s) for querying AIS data | 10 |
| period | Period in ms for the HTTP-JSON query to SignalK. If the Python WebSocket libraries are available (the standard case), this interval is increased to nearly the *expiryTime* of the data in AvNav. | 1000 |
| fetchCharts | Fetches information about the charts installed in SignalK. For this, the SignalK Chart Provider must be installed there. | on |
| chartQueryPeriod | Interval (in s) for querying charts. | 10 |
| chartProxyMode | If SignalK runs on a different computer than AvNav, the browser might not be able to reach that computer directly. Therefore, there is the possibility that chart loading occurs via a proxy in AvNav. This does generate some additional load and can be switched off. *sameHost*: only proxy if SignalK is not running on the same server as AvNav *never*: no proxy (can be used if the SignalK server is reachable from the browser at the address entered here) *always*: always proxy. Can be used if the SignalK port (3000) is not directly reachable from outside. | sameHost |
| ignoreTimestamp | Normally, the handler evaluates the timestamp of the SignalK data and ignores data that is too old (*expiryPeriod* in AVNConfig). A potential time difference between your own server and the SignalK server is taken into account. SignalK, however, sometimes does not use its local time as a basis for this timestamp but takes the timestamp from received data. This can be far in the past, especially when using simulation data - and AvNav would ignore such data. By setting this flag, AvNav ignores these timestamps and enters its local time of the last value change as the timestamp. This is obviously not as accurate as the original timestamp in SignalK, but it allows older simulation data to be used. | off |
| sendData | Send data to SignalK. It can be configured whether alarms and/or waypoint data can be sent. These settings only become visible if sendData is activated. This **does not control the sending of NMEA data** to SignalK! | off (on on OpenPlotter) |
| userName | The name of a SignalK user with write permissions on the SignalK server. This user must have been created in advance in SignalK with the corresponding rights. Unfortunately, SignalK has no interface to directly check whether a specific user can write to the desired paths; it only checks for "localhost" whether write permissions exist. | admin |
| password | The password for the configured user. This password is normally not required for a SignalK installation on the same server, provided the configuration is located at the standard path $HOME/.signalk/security.json. If an error occurs under "authentication" in the status display, setting the password locally might solve the problem. Attention: The password is saved in plain text in the avnav_server.xml file. | <empty> |
| sendWp | Send waypoint data to SignalK. See also [Mapping](#mapping). | on |
| legPaths | Paths for waypoint data (only with sendWp). *v1*: navigation.courseGreatCircle/courseRhumbline, *v2*: navigation.course (SignalK 2.x Course API), *both*: both. | both |
| sendNotifications | Send AvNav alarms as notifications to SignalK - see [Mapping](#mapping). | on |
| receiveNotifications | Receive notifications from SignalK as alarms. | off |
| notifyWhiteList | A comma-separated list of SignalK notifications to be received. Specify the paths without "notification." - e.g., navigation.arrivalCircleEntered,mob,fire,sinking. If the list is empty, all notifications are received - but the notificationBlacklist is still considered. | <empty> |
| notifyBlackList | A comma-separated list of SignalK notifications that should not be received. | server.newVersion |
| webSocketRetry | Interval (in s) to attempt rebuilding a WebSocket connection if the previous one was closed. | 20 |


Some of the parameters only become visible if the "parent" parameter has been activated.

  

## Mapping {: #mapping}

The SignalK paths are mapped to AvNav data paths as follows:

/vessels/self/... => gps.signalk....

These paths are not used internally in AvNav but can be displayed.

If "decodeData" is activated, the mapping occurs as follows (see [in the code](https://github.com/wellenvogel/avnav/blob/c67ee491bc19d579f379eb78bcde149282806ab2/server/avnav_nmea.py#L122)).

Note: Courses/angles are stored internally in AvNav in °, and in SignalK in rad. If multiple SignalK paths are specified, the first one found in SignalK is used.

|  |  |
| --- | --- |
| SignalK under /vessels/self/ | AvNav |
| navigation.headingCompass | gps.headingCompass |
| navigation.headingMagnetic | gps.headingMag |
| navigation.headingTrue | gps.headingTrue |
| environment.water.temperature | gps.waterTemp |
| navigation.speedThroughWater | gps.waterSpeed |
| environment.wind.speedTrue | gps.trueWindSpeed |
| environment.wind.speedApparent | gps.windSpeed |
| environment.wind.angleApparent | gps.windAngle |
| environment.wind.angleTrueWater (since 20240520) | gps.trueWindAngle |
| navigation.position.latitude | gps.lat |
| navigation.position.longitude | gps.lon |
| navigation.courseOverGroundTrue | gps.track |
| navigation.speedOverGround | gps.speed |
| environment.depth.belowTransducer | gps.depthBelowTransducer |
| environment.depth.belowSurface | gps.depthBelowWaterline |
| environment.depth.belowKeel | gps.depthBelowKeel |
| navigation.datetime | gps.time |
| navigation.gnss.satellitesInView.count | gps.satInview |
| navigation.gnss.satellites | gps.satUsed |
| navigation.magneticDeviation (since 20240520) | gps.magDeviation |
| navigation.magneticVariation (since 20240520) | gps.magVariation |
| environment.current.setTrue (since 20240520) | gps.currentSet |
| environment.current.drift (since 20240520) | gps.currentDrift |

AIS data is mapped as follows ("fetchAis" on):

|  |  |  |
| --- | --- | --- |
| SignalK vessels/\*/ | AvNav ais | Note |
| mmsi | mmsi | data is only taken if MMSI is set |
| name | shipname |  |
| navigation.speedOverGround | speed |  |
| navigation.courseOverGroundTrue | course |  |
| communication.callsignVhf | callsign |  |
| design.aisShipType | shiptype |  |
| navigation.position.longitude | lon |  |
| navigation.position.latitude | lat |  |
| navigation.destination | destination |  |
| sensors.ais.class | type | Class A -> type 1 / Class B -> type 18 / Other -> type other |
| design.beam | beam |  |
| design.length | length |  |
| design.draft | draught |  |
| navigation.state | status |  |
| navigation.headingTrue | heading |  |
| atonType | aid\_type |  |

If "sendWp" is active, the data is mapped as follows:

|  |  |
| --- | --- |
| AvNav | SignalK vessels/self/ |
| currentLeg.to.lon | navigation.courseGreatCircle.nextPoint.position.longitude and navigation.courseGreatCircle.nextPoint.longitude |
| currentLeg.to.lat | navigation.courseGreatCircle.nextPoint.position.latitude and navigation.courseGreatCircle.nextPoint.latitude |
| currentLeg.from.lon | navigation.courseGreatCircle.previousPoint.position.longitude |
| currentLeg.from.lon | navigation.courseGreatCircle.previousPoint.position.latitude |
| currentLeg.distance | navigation.courseGreatCircle.nextPoint.distance |
| currentleg.dstBearing | navigation.courseGreatCircle.nextPoint.bearingTrue and navigation.courseGreatCircle.bearingToDestinationTrue |
| currentLeg.xte | navigation.courseGreatCircle.crossTrackError |
| currentLeg.approachDistance | navigation.courseGreatCircle.nextPoint.arrivalCircle |
| currentLeg.bearing | navigation.courseGreatCircle.bearingTrackTrue and navigation.courseGreatCircle.bearingOriginToDestinationTru |

With *legPaths* *v2* or *both*, the paths of the SignalK 2.x course data structure are additionally sent as deltas (only for SignalK server version 2.0 and later):

* navigation.course.nextPoint and 
* navigation.course.previousPoint (each with position and type=Location, *previousPoint* is the start point of the AvNav leg).
* navigation.course.arrivalCircle as well as - if no active *course-provider* was found -
   * navigation.course.calcValues.(calcMethod, distance, bearingTrue, bearingTrackTrue, crossTrackError, velocityMadeGood).

**Attention:** If AvNav sends the waypoint (sendWp), the SignalK plugin "course-provider" should be deactivated, as it would otherwise calculate the calcValues itself.

However, this only works if the current position is also available in SignalK. Potentially, a restart of the routing would not correctly reset the XTE calculation by the plugin.

AvNav regularly checks if the plugin is running. In this case, AvNav does not send *calcValues* and the status display "courseProvider" turns red; if the plugin is not present or deactivated, it is green.
These values are used, for example, by the plugins *signalk-to-nmea2000* and *signalk-to-nmea0183* for autopilots.
If a course is set in SignalK that does not originate from AvNav while a leg is active in AvNav, this is reset via REST (DELETE on `/signalk/v2/api/vessels/self/navigation/course`) before sending - the active leg in AvNav has priority. Write permissions are required for this. Querying the SignalK Course API (`/signalk/v2/api/vessels/self/navigation/course`) does not return the sent values - AvNav does not set a destination there.

If the AvNav routing mode is "Rhumbline", "courseGreatCircle" is replaced by "courseRhumbline". Sending some values multiple times with different paths is a workaround for some SignalK bugs (like <https://github.com/SignalK/signalk-to-nmea2000/issues/94>).

For notifications, there are a few mappings; unmapped notifications are handled in AvNav with their name prefixed with "sk:". E.g., "notifications.sinking" becomes "sk:sinking".

|  |  |  |
| --- | --- | --- |
| AvNav | SignalK vessels/self/notifications | Value |
| mob | mob | state:emergency, method:visual,sound, message:man overboard |
| waypoint | arrivalCircleEntered | state: normal, method: visual,sound, message: arrival circle entered |
| anchor | navigation.anchor | state:emergency, method: visual,sound, message: anchor drags |

SignalK notifications without a direct mapping are assigned to a category based on their status (*state*). This can be used in the AVNCommandHandler to define the command to be executed and the sound.

emergency -> critical

alert -> info

warn -> alarm

alarm -> alarm

In the AVNAlarmHandler, further alarms can also be [configured](configfile.md#avnalarmhandler). The *sk:name* must be used as the name. These will then be treated according to their configuration.

## SignalK - Charts {: #SignalKCharts}

As of version 202011xx, the [SignalK Chart Provider](https://github.com/SignalK/charts-plugin) is also integrated. Charts offered there can also be selected on the landing page. For this, the corresponding plugin must of course be installed and activated within SignalK - and charts must be available there.

Normally, AvNav only provides information about the charts; access to the charts occurs directly from the browser to SignalK.

If this is prevented, e.g., by firewall settings, you can also route all chart accesses through AvNav (proxy) - see [configuration](#configuration).