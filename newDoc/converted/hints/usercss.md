user css



Anpassung mit css
=================

Da AvNav eine Web-Anwendung ist (single page app mit [reactjs](https://reactjs.org/)),
kann man das Aussehen weitgehend mit CSS anpassen.

Die dafür vorgesehene Datei user.css befindet sich (wie die Datei [user.js](userjs.md))
im BASEDIR/user/viewer Verzeichnis (BASEDIR ist /home/pi/avnav/data auf
dem Pi).

Über die Files/Download Seite {{BT("DBDownload")}}und die Unterseite {{BT("AddonConfigUser")}} kann man die Datei direkt bearbeiten.

![](../img/downloadpage-user.png)

Durch Klick auf die Datei und Auswahl von "Edit" kann die Datei
bearbeitet werden. Bei der Installation wurde ein Template eingebracht,
das ein Beispiel enthält.

Ab Version 20210619 wird der Name des aktuellen Layouts als CSS Klasse an
der Applikation gesetzt. Dabei werden alle Sonderzeichen durch einen "\_"
ersetzt. Das Layout user.default führt somit zu einer CSS Klasse
user\_default. Man kann damit CSS Einstellungen vornehmen, die spezifisch
für ein bestimmtes Layout sind (damit kann man für unterschiedliche Geräte
auch unterschiedliche CSS Einstellunegn nutzen).

```
.user_default .widget .COG {  
 color: green;  
}  
.user_special .widget .COG {  
 color: red;  
}
```

Eine sinnvolle Vorgehensweise ist die Nutzung der Developer Tools
(Chrome, Firefox,...), die Auswahl des Elementes, das angepasst werden
soll und ein Test der Änderungen in den Tools.

Anschliessend kann man die Werte in die user.css Datei übernehmen und
durch Neu-Laden der AvNav Seite testen.

  