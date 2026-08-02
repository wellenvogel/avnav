# Routen
Beschäftigen wir uns nun mit der Routen-Funktion. Die Abläufe werden **[in diesem Video]({{VURL("routes")}}){.videolink}** gezeigt.

## Der Routeneditor
Das Erstellen einer Route geht am einfachsten direkt aus der [Navigationsseite](navpage.md) über die Schaltfläche {{BT("ToRoute")}}. 

![](../../img/route-editor.png)

Die Kartenansicht bleibt, aber die Buttonleiste rechts hat sich verändert. 

- ### Neue Route <br>
Man klickt links unten in das Routen Widget (RTE) und legt eine neue Route an, indem man nach Klick auf {{DB("DBNewRoute")}} der Route einen neuen Namen (z.B. "Test") gibt und zweimal mit {{DB("DBOk")}} bestätigt.  Anschließend zeigt der Dialog im Widget, dass nun die Route „Test“ geladen ist und diese noch keinerlei Wegepunkte enthält. 
![](../../img/route-NewRoute.png)

- ### Wegepunkte setzen <br> 
Das Setzen von Wegepunkten erfolgt in AvNav, indem das Fadenkreuz auf die Position geschoben wird, wo der Wegepunkt gesetzt werden soll. Das geschieht mit einem  Klick auf {{BT("NavAddAfter")}}. Dabei beziehen sich 'After' und 'Before' auf den aktuell aktivierten Wegepunkt. Dieser ist auf der Karte rot und in der WP-Liste des RTE Widgets fett hervorgehoben. In diesem Beispiel erstellt man am Fadenkreuz über den Button {{BT("NavAddAfter")}} die Route WP1->WP2-WP3. Über den Button {{BT("NavAdd")}} entsteht folglich die Route WP1->WP3->WP2<br><br>
![](../../img/route-AddWp2.png)


- ### Wegepunke bearbeiten
Um einen Wegepunkt zu verschieben, muss er zunächst direkt markiert werden. Das geht etwa in der Karte durch Klick oder durch Auswahl seines Listeneintrags im RTE Widget. Anschließend die gewünschte Position unter das Fadenkreuz setzen und den Wegepunkt mit {{BT("NavToCenter")}} verlegen. Analog kann man den Wegepunkt löschen - dafür nutzt man den Button {{BT("NavDelete")}}.<br>Die Arbeit mit dem Fadenkreuz mag im ersten Augenblick etwas umständlich wirken im Vergleich zu direkten Klicks auf den Touchscreen. In Situationen mit einem sich stark bewegenden Schiff, auf einem kleineren Bildschirm, und mit klammen Fingern wird man diese Art der Bedienung aber zu schätzen lernen.

## Routen speichern und laden
Änderungen an Routen werden in der Regel sofort am AvNav Server gespeichert. Ist dieses Systemverhalten unerwünscht, weil man beispielsweise die gerade aktive Route bearbeitet, bietet sich der sogenannte disconnected Mode an: dabei bleiben Änderungen lokal im Browser und werden bis auf Weiteres nicht zum Server synchronisiert. Diese Trennung erreicht man durch Deaktivieren des connected Mode über den Button {{BT("DBConnect")}} im Display des Funktionsbereich "Routes". Änderungen bleiben solange lokal, bis man den connected Mode wieder aktiviert - dann wird gefragt, was mit den Änderungen geschehen soll - sie können übernommen oder verworfen werden.

![](../../img/routespage.png)

In der zweiten Spalte sind die gespeicherten Routen gelistet. Sie können dort unter anderem gelöscht, kopiert, heruntergeladen, von gpx Dateien importiert oder editiert werden. Auf schmalen Bildschirmen ist diese zweite Spalte eventuell nicht sichtbar - man erreicht sie dann über Wischen.

## WP Buttons {: #wp-buttons}
Beim Bearbeiten, aber auch beim Nutzen einer Route bieten sich weitere Möglichkeiten, wenn man die Schaltfläche {{BT("NavActions",False)}} und in "Navigation tools" {{BT("ABShowWpButtons", True)}} anklickt. Die Schaltflächen {{BT("WpNext",False)}} und {{BT("WpPrevious",False)}} bewegen die Markierung von Wegepunkt zu Wegepunkt, wenn die Arbeit im Widget oder in der Karte als ungünstiger empfunden wird. Über {{BT("Edit",False)}} kann jeder einzelne Wegepunkt editiert werden, etwa um einen neuen Namen zu vergeben. Mit {{BT("WpLocate",False)}} kann man den angewählten Wegepunkt schnell wieder ins Kartenfenster holen, wenn die Karte aus irgendwelchen Gründen woanders hin verschoben wurde. Das geht allerdings auch mit Anklicken des Wegepunkts im RTE Widget. 

## Route aktivieren
Sind alle Eingaben erledigt, kann die Route aktiviert werden. Das geht über den Klick auf den Start-Button {{BT("NavGoto",False)}}. Bevor das passiert, sollte noch einmal geprüft werden, welcher Wegepunkt aktuell aktiv ist - dorthin startet die Route. Wir legen also WP 1 als erstes Leg von unserer Position aus fest und klicken auf {{BT("NavGoto",False)}}.  

![](../../img/route-run.png)

Die Route wird nun aktiv, die Ansicht springt zurück in das normale Navigationsfenster. Aus 
dem {{BT("NavGoto",False)}} wird {{BT("StopNav",False)}}. Damit lässt sich die Aktivierung der Route wieder zurücknehmen. Dass die Route nun aktiv ist, erkennt man außerdem daran, dass die Richtung zum WP als ockerfarbige Linie angezeigt wird, und die Widgets die routenbezogenen Werte beinhalten, also die Distanz zum nächsten Wegepunkt (DST), den Kurs (BRG) dorthin, im RTE Widget die Länge der Route und die ETA. <br><br>

Die [WP Buttons](#wp-buttons) bieten auch während des Abfahrens der Route nützliche Funktionen. Sollte man sich spontan entscheiden, einen Wegepunkt auszulassen, ohne die Route gleich in ihrem Ablauf ändern zu wollen, ist der {{BT("NavNext",False)}} die richtige Wahl: klickt man darauf, springt die Route auf den nächsten Wegepunkt. Das kann hilfreich sein, wenn man einen Wegepunkt in einer so großen Entfernung passiert, dass das Erreichen des Wegepunktes vom System nicht automatisch quittiert wird. <br><br>

Der Kurs zum nächsten Wegepunkt wird automatisch aktualisiert und im Standard als ockerfarbene Linie dargestellt. Der bei der bei Beginn des Legs festgelegte Kurs zeigt sich als [gestrichelte schwarze Line](./navpage.md#vectors). Der Button {{BT("NavRestart",False)}} führt (etwa nach Verschieben des Wegepunkts unterwegs) eine neue Erstberechnung aus - dabei wird XTE zurückgesetzt: die gestrichelte und die ockerfarbene Linie liegen wieder zusammen.