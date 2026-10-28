---
  tags:
    - Client
    - Server
---
# System concept: how AvNav works

To be able to operate and set up AvNav correctly in everyday life, it is helpful to understand the basic idea of the software. One secret to AvNav's performance lies in its separation of computing work and display – the so-called client-server architecture. 

With a classic chart plotter or a standard smartphone app, all processes happen in a single device. If it crashes or the battery dies, navigation stops, and the anchor alarm falls silent. AvNav solves this problem by dividing the system into two components.

The centerpiece is the AvNav server. It runs in the background, often on a small, permanently installed minicomputer below deck. This server is the computing center: it reads data from connected devices via a wide variety of interfaces: GPS antenna, wind data, AIS signals. It continuously calculates the route, writes logs and protocols, checks the anchor alarm, and keeps the chart material ready. 

The second component is the client, for example, the device that the user holds in their hand for operation. The client no longer requires its own navigation software. A commercially available web browser (such as Safari, Chrome, or Firefox) is completely sufficient. You connect to the WiFi network provided by the server and simply call up the web address of the AvNav server on the tablet or smartphone. The complete nautical chart, including instrument displays, is immediately available.

This concept offers unbeatable advantages in everyday life on board. The most obvious is the reliability: if the tablet in the cockpit becomes unusable due to rainwater or turns off because of a dead battery, the system below deck simply continues running. The route remains active, the autopilot continues to steer its course, and the anchor watch remains armed. Any other device, such as a smartphone, can be used at any time. You connect it to AvNav via the onboard WLAN and continue navigating exactly where the tablet left off. In addition, several crew members can access the system simultaneously with different devices – the skipper plans the route for the next day on the laptop at the chart table, while the helmsman monitors the current course outside on the tablet. Everyone sees the same, always synchronous data set.