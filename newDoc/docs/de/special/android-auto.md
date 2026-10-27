---
  tags:
    - Android
    - AndroidAuto
---

# AvNav auf Android Auto

Für den Einsatz von AvNav auf dem Boot benötigt man typischerweise ein möglichst helles Display ("sonnenlicht-tauglich") von mindestens 8 Zoll. Durch die zunehmende Verbreitung von modernen Navigations- und Entertainment Systemen in Autos gibt es immer mehr preiswerte Displays (< 100 €), die eine hohe Helligkeit bieten und für den Einsatz in Autos vorgesehen sind. Diese Displays haben oft keine eigene Navigations- oder Anzeige-Software sondern verlassen sich auf [Android Auto](https://de.wikipedia.org/wiki/Android_Auto) oder [Apple CarPlay](https://de.wikipedia.org/wiki/CarPlay).

Das erfordert ein entsprechendes Mobilgerät (Android bzw. IOS) mit der passenden Software. Die Displays unterstützen dabei meist eine Verbindung über USB - in neueren Versionen auch per Bluetooth und Wifi.

Da es von AvNav auch eine Android Version gibt, kann man es auch für die Anzeige auf einem AndroidAuto fähigen Display einrichten. Man kann das Mobilgerät dann geschützt in der Kajüte belassen und nur das Display muss ggf. aussen sicht- und erreichbar sein.

Wie man das machen kann, wird hier beschrieben.

## Voraussetzungen

Auf dem Mobilgerät muss [AndroidAuto](https://play.google.com/store/apps/details?id=com.google.android.projection.gearhead&hl=de) installiert sein- das ist auf modernen Geräten meist schon vorinstalliert.

Ausserdem muss eine App, die unter AndroidAuto genutzt werden soll, entsprechend vorbereitet sein.
Google legt hier strenge Maßstäbe an, welche App mit welchen Funktionen dann auch AndroidAuto nutzen darf. 

Eine App wie AvNav kann diese Maßstäbe nicht direkt einhalten, aber im Folgenden wird beschrieben, wie man es trotzdem nutzen kann.

Die weiter unten beschriebene Lösung erfordert ein Mobilgerät mit mindestens Android 15.

## Vorbereitungen

Die hier beschriebenen Arbeiten muss man einmalig ausführen um die Nutzung vorzubereiten.

Da AvNav selbst nicht direkt unter AndroidAuto laufen kann, wird die Server-Funktion von AvNav genutzt. Damit benötigt man nur noch einen Browser, der unter AndroidAuto lauffähig ist.

Es gibt dafür den [AABrowser](https://github.com/kododake/AABrowser). Da er nicht im Play Store verfügbar ist, muss man die APK direkt von der [GitHub-Release-Seite](https://github.com/kododake/AABrowser/releases/) herunterladen und dann auf dem Mobilgerät installieren. Dazu muss man die Installation aus unbekannten Quellen zulassen.

Wie auch auf der GitHub Seite beschrieben muss man in AndroidAuto auf dem Mobilgerät ausserdem noch zulassen, das auch Apps genutzt werden können, die nicht den strengen Google-Maßstäben genügen.

Man öffnet dazu AndroidAuto auf dem Mobilgerät und aktiviert den Entwicklermodus durch 10x Tippen auf "Version".

![AndroidAuto Entwicklermodus](../../img/android-auto-cfg.png)

Über das Menü (3 Punkte) geht man zu den Entwickler-Einstellungen und aktiviert "Unbekannte Quellen".

![Android Auto ubekannte Quellen](../../img/android-auto-cfg2.png)

Anschliessend kann man in AndroidAuto über "Launcher anpassen" dafür sorgen, das der AABrowser mit im Launcher von AndroidAuto erscheint.

Damit hat man den ersten Teil abgeschlossen - wenn man jetzt das Mobilgerät mit dem AndroidAuto Display verbindet, kann man den AABrowser dort aufrufen.

Nun wird im AABrowser noch ein Lesezeichen für AvNav angelegt um die Anzeige schnell öffnen zu können.

Dazu startet man AvNav und prüft noch einmal ob unter {{MM("MMserverpage")}} der Webserver aktiv ist.

Anschliessend kann man AvNav über {{MM("MM:actions")}}-> {{BT("MainExit",True)}} in den Hintergrund schicken (nicht beenden!).

Jetzt öffnet man den AABrowser einmal direkt auf dem Mobilgerät und gibt die Adresse `http://127.0.0.1:8080` ein (der Port muss natürlich mit dem beim AvNav Webserver eingerichteten Port übereinstimmen - 8080 ist der default). AvNav sollte nun angezeigt werden.

![AABrowser AvNav](../../img/android-auto-aa1.png)

Über den Menü-Button des AABrowsers kann man nun diese Seite für den Start einrichten.

Zunächst legt man eine Lesezeichen für die Seite an ("Bookmarks").

![AABrowser Bookmark](../../img/android-auto-aa2.png)

Im Bild wurde das Lesezeichen schon angelegt, sonst muss man zunächst "Add" klicken. Über den Pin Button legt man dieses Lesezeichen jetzt noch in einen sogenannten "Slot" - das ist eine Liste von Bookmarks, die direkt auf der Startseite angzeigt werden.

Danach kann man den AABrowser noch einmal verlassen und neu starten um es zu testen. Der Browser merkt sich immer die zuletzt angezeigte Seite und wird so AvNav im Normalfall direkt wieder öffnen.

Die Anzeige des Menü-Buttons vom AABrowser kann man noch abschalten, indem man in AvNav in den Fullscreen Modus wechselt:

{{MM("MM:actions")}}-> {{BT("FullScreen",True)}}

## Normale Nutzung

Um AvNav in dieser Konfiguration zu nutzen, muss man nach dem Start des Mobilgerätes AvNav einmal starten und wieder in den Hintergrund schicken. Leider verbieten die Google-Datenschutzeinstellungen einen automatischen Start einer Software, die auf Standort-Daten zugreifen möchte, so das dieser händische Schritt nötig ist.

Manche Mobilgeräte oder auch andere Apps bieten aber Funktionen um bestimmte Apps automatisch zu starten - in diesem Fall kann man AvNav auch automatisch starten.

Danach kann man das Mobilgerät mit dem Display verbinden (das sollte im Normalfall automatisch erfolgen) und auf dem Display den AABrowser starten.

### Automatischer Start auf Samsung

Samsung Mobilgeräte bieten mit [Modi und Routinen](https://www.samsung.com/de/support/mobile-devices/modi-und-routinen/) eine sehr komfortable Möglichkeit beispielsweise eine App zu starten, wenn man sich mit einem AndroidAuto Display verbindet.

Dazu muss man eine Routine erstellen, die als Bedingung "AndroidAuto verbinden" hat und als Aktion des Starten einer App - AvNav. Das ist mit wenigen Klicks erledigt. Damit wird AvNav automatisch gestartet, wenn AndroidAuto verbunden wird.

### Andere Mobilgeräte

Wenn das Mobilgerät selbst keine solche Automatisierungsmöglichkeit bietet, kann man eine App wie [MacroDroid](https://wiki.macrodroid.com/wiki/index.php?title=MacroDroid_Wiki) oder [Tasker](https://tasker.joaoapps.com/) nutzen.


## Sicherheitshinweis

Für den beschriebenen Anwendungsfall ist die Nutzung des AABrowsers auf einem Display keine Gefahr.

**Wenn man jedoch das gleiche Mobilgerät auch im Auto nutzt und dort mit dem Display verbindet ist die Nutzung des AABrowser dort definitiv nicht gestattet. Es liegt also in der Verntwortung des Nutzers, das zu beachten.**