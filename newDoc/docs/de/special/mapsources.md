---
  tags:
    - Karten
---
Mobile Atlas Creator Mapsources {: #Mobac}
==========================================

2022/04/17  
Anpassungen an mobac 2.2.2

2021/08/22  
Anpassungen an mobac 2.2x, Anpassung an  neue BSH Layer

2020/01/26  
Weitere kleine Modifikationen an den Map-Sources, damit der
Zugriff auf die BSH-Server wieder funktioniert.

Sourcen
-------

Für den [Mobile Atlas Creator](https://mobac.sourceforge.io/)
habe ich einige Map-Sources erzeugt, die es erlauben, etwas flexibler per
*XML* den Zugriff auf Kartendienste zu definieren. Dazu die Datei [avnav-mapsources.zip]({{DLLINK("avnav-mapsources.zip")}})
im Verzeichnis "mapsources" des Mobile Atlas Creator entpacken.   
Für Mobac Version 2.2.1 bitte die Datei [avnav-mapsources-before222.zip]({{DLLINK("avnav-mapsources-before222.zip")}})
nutzen.  
Für Mobac Versionen < 2.2.1 bitte die Datei [avnav-mapsources-before22.zip]({{DLLINK("avnav-mapsources-before22.zip")}})
nutzen.

Dann erhält man u.a. ein "MeshUp" aus den BSH-Kartendiensten - siehe auch [bsh-viewer]({{HPLINK("../bshviewer/bshviewer.html")}}) und OpenSeaMap
("BSH OpenSeaMap 2021 Extended"), außerdem noch BSH allein ("BSH 2021
Extended") oder OpenSeaMap + OpenStreetMap ("OWS OpenSeaMap 2021"). 

Wenn jemand "spielen" möchte, kann man die **.exml*-Datei entsprechend anpassen.
Spannend sind insbesondere die Layer für die BSH-Abfrage. Die kann man mit
meinem [BSH-Viewer]({{HPLINK("../bshviewer/bshviewer.html")}})
ausprobieren: Jeweils rechts in der Quelle editieren! Außerdem kann man
bei Bedarf die Farben noch etwas anpassen - ich habe mich bemüht, etwas
mehr Kontrast zu erzeugen. Wenn man etwas ändern will - eine der Karten
z.B. mit *paint.net* öffnen und dann die Hex-Werte für die Farben heraussuchen
und in der *.exml*-Datei eintragen.

Der Download dauert meist ziemlich lange - oft ist der BSH-Server sehr
langsam oder stürzt auch gerne einmal ab. Dann einfach wieder neu versuchen:
Dazu im Mobac die Cache-Einstellungen so setzen, dass die Karten z.B.
1 Monat im Cache gelassen wird - irgendwann sind sie alle heruntergeladen. Als
Format jetzt immer "OsmdroidGEMF" wählen. Das kann man übrigens auch in
anderen Programmen nutzen...

Wenn man in den **.exml*-Dateien ändert, insbesondere bei den Layern, muss
man allerdings unter *Tilestore* die entsprechenden Caches löschen - sonst
werden die Änderungen nicht wirksam.

Source Files auf [github](https://github.com/wellenvogel/avnav/tree/master/mobac/testsrc).

Das Ergebnis sieht z.B. so aus. Die Karte zeigt die Einfahrt nach Greifswald:

![](../../img/MobacExampleBsh.PNG)

Hier noch einmal die Dateien:

* [avnav-mapsources.zip]({{DLLINK("avnav-mapsources.zip")}})
  (die Mapsources BSH, BSH+OpenSeaMap)

  