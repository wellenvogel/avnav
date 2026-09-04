# Overlays

[Hier]({{VURL("overlays")}}){.videolink} geht es zu einem Video, das die Basisfunktionen erklärt.

## Einführung

Overlays dienen dazu, Karten in AvNav mit weiteren Informationen zu ergänzen.
Das bedeutet, dass Karten mit weiteren Daten und Darstellungen hinterlegt werden, um in der Karte zusätzliche Informationen anzuzeigen oder die aktuelle Karte sinnvoll zu erweitern.

Ein Beispiel ist die Nutzung einer Karte für Deutschland - das Fahrtgebiet ist aber der  Grenzbereich zwischen Deutschland und Dänemark in der Flensburger Förde.

Das würde bedeuten, je nach Kurs und Position immer wieder zwischen einer dänischen und einer deutschen Karte hin- und her zu schalten. Um das zu vermeiden, kannt man in AvNav einer Karte eine weitere Karte als Overlay zufügen. So werden beide Karten in der Navigationsansicht sichtbar und erzeugen einen nahtlosen Übergang.

Ebenso kann man Informationen aus anderen Quellen herunterladen, um ein Wegepunktverzeichnis in der Karte darzustellen oder zum Beispiel ein Verzeichnis dänischer Ankerbojen und vieles mehr.

Auch ist es möglich, Routen und Tracks in die Karte zu holen, um sie zu vergleichen oder als Vorlage für eine neu zu erstellende Route zu verwenden.

Auch Satellitenbilder lassen sich in AvNav-Karten überlagern, dazu ist allerdings eine Quelle für Satellitenkarten notwendig und eine gewisse Vorbereitung. Dieses Verfahren kannst du in der Doku nachlesen.

## Zuordnung {: #assign}

Wie werden Overlays bestimmten Karten zugeordnet?
Um zwei im System vorhandene Karten nebeneinander zu legen, kann man einen sehr schnellen Weg wählen, nämlich direkt aus der  Navigationsseite heraus über den Button {{BT("NavSelectChart")}}.

Bei einer der Karten, die man nebeneinander legen möchte, klickt man rechts auf den Overlay Button. Dann öffnet sich der Edit-Overlay Dialog.

![Overlay Dialog](../../img/overlays-dialog1.png)
///caption
Overlay Dialog
///

Dort klickt man die Schaltfläche {{DB("DBInsertAfter")}}, um der Basiskarte eine weitere Karte hinzuzufügen.

Es öffnet sich dann ein weiterer Dialog, dort wählt man die Option „chart“ und klickt auf die Zeile „name“. Nun kann man aus einer der installierten Karten auswählen.

![Overlay Dialog](../../img/overlays-dialog2.png)
///caption
Karte als Overlay
///

Nach Klick auf {{DB("DBOk")}} landet man wieder im Ausgangsdialog „Edit Overlay“ und bestätigt das neue Overlay nun mit {{DB("DBSave")}}.

Das war es schon. In der Kartenliste erkennst du das Overlay nun am geschwärzten Icon rechts neben dem Kartennamen.

Um eine Route, eine Wegepunktliste oder ein Bojenverzeichnis als Overlay einzufügen, musst du die entsprechenden Dateien zuvor irgendwo herunter laden und in AvNav einfügen. AvNav akzeptiert solche Dateien mit den Formaten GPX, KML, KMZ, GEOJSON.

Nachdem du die Quelldateien auf deinem Rechner gespeichert hast, wechselst du in AvNav in den Bereich 

{{MM("MMchartspage")}}

In der Spalte "Overlays" kannst du deine Dateien dann hochladen.
Als Beispiel wird hier die Wegepunktliste des NV-Verlags genutzt, die kostenlos zum Download zur Verfügung steht.

Klicke auf "Upload" {{SB("Upload")}}, wähle die Datei aus und überprüfe, ob sie in der Liste unter Overlay sichtbar wird. Nun könntest du den gleichen Weg gehen, der eben für die Karten bereits beschrieben wurde.

Da du aber sowieso schon im Bereich Charts/ Overlays bist, kannst du direkt aus der Overlay-Liste eine Datei einer Karte zuordnen, also quasi der umgekehrte Weg zu eben. 
Klicke dazu auf das Stiftsymbol neben der gewählten Datei, klicke dann auf Overlays und suche über den aufklappenden Dialog die Karte aus, der du das Overlay zuordnen willst.

![Overlays von Datei](../../img/overlays-dialog3.png)
///caption
Wegepunkte als Overlay
///

Die sollten natürlich zusammen passen. Die Bojen des dänischen Tursejlerverbands werden auf einer deutschen oder niederländischen Karte kaum zu finden sein…

Ist die Zuordnung Overlay zu Karte erzeugt, bestätige im Edit Overlay-Dialog mit {{DB("DBSave")}}. 

In der Kartenliste auf der Navigationspage findest du nun das aktive Overlaysymbol neben der eben zugeordneten Karte.  
Übrigens kannst du, wenn du im Edit-Overlay-Dialog auf das Stiftsymbol eines Overlays klickst, weitere Einstellungen am jeweiligen Overlay vornehmen. Die Opazität ist in Dezimalschritten von 0-1 einstellbar. Am besten ist es, wenn du die Werte händisch einträgst, z.B. 0,5 für leicht durchscheinend. Probiere die verschiedenen Möglichkeiten in Ruhe aus, bis du eine Darstellung entwickelt hast, die deinen Bedürfnissen entspricht. 
Kleiner Tip: Die Wegepunktliste erscheint nur in der Karte, wenn die Textdarstellung ausgewählt ist.
Nun sind beide Wege, wie Karten und Overlays zusammengefügt und editiert werden können, gezeigt worden.
Ein kurzer Hinweis am Ende zum Umgang mit Overlays zum Beispiel während eines Törns. Da kann es gut vorkommen, dass die überlagerten Informationen durch Overlays die Kartendarstellung auch stören. Um die Overlays schnell abschalten zu können, hast du direkt auf der Navigationspage über den Charts-Button und die angezeigte Kartenliste die Möglichkeit dazu, indem du auf „Hide Overlays“ klickst.
Show Overlays würde danach die Overlays deiner gewählten Karte schnell wieder aktivieren. Damit du nicht durcheinander kommst, ist immer nur die jeweilige Möglichkeit aktiv, die andere ausgegraut.
