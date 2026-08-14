# Betriebssysteme

Dank seiner Client-Server-Architektur lässt sich AvNav auf einer Vielzahl von Geräten nutzen. Vor der Installation steh die Entscheidung, welche Plattform für die individuellen Bedürfnisse am besten geeignet ist. Grundsätzlich gibt es drei typische Szenarien.

## Raspi OS 
Die von vielen Nutzern bevorzugte Lösung ist der Einsatz als Komplettsystem auf Basis eines [Raspberry Pi](../installation/raspberry.md), einem kleinen, preiswerten Linux-Minicomputer. Dieses Szenario ist ideal für Bootseigner, die ein dediziertes, zuverlässiges System anstreben. Dieser Ansatz basiert in der Regel auf zwei Möglichkeiten: entweder nutzt man das speziell vorkonfigurierte AvNav-Image oder man installiert AvNav als Zusatz auf einem bestehenden OpenPlotter-Image. Als "Image" werden dabei Softwarepakete bezeichnet, welche nicht nur die Anwendung selbst, sondern gleich das gesamte passend abgestimmte Betriebssystem enthalten.

Fällt die Entscheidung für das AvNav-Image, ist die Nutzung flexibel: man kann den Raspberry Pi als reinen Server ("headless") betreiben, der unsichtbar unter Deck arbeitet und ein eigenes WLAN-Netz aufspannt. Für die Anzeige im Cockpit dienen dann einfach ein oder mehrere handelsübliche Tablets, die sich drahtlos mit diesem Zentralrechner verbinden. Alternativ bietet sich aber auch die Komplettlösung an, nutzbar mit direkt angeschlossenem Bildschirm, optional auch mit Maus und Tastatur. 

Fest unter Deck installiert und direkt an das 12-Volt-Bordnetz sowie an alle Bootsinstrumente angeschlossen, läuft der Raspberry Pi oft die gesamte Zeit über ununterbrochen durch. Er verbraucht dabei extrem wenig Strom. Wenn AvNav als dauerhafte, zentrale Navigationslösung dienen soll, ist dies der empfohlene Weg.

## Android
Eine sehr beliebte Alternative ist die Nutzung von AvNav als Android-App. Dies ist der schnellste und unkomplizierteste Einstieg. AvNav kann auf jedem beliebigen Android-Tablet oder Smartphone (oder auch auf einem Android-Autoradio)  installiert und dieses als völlig eigenständiges System ("Standalone") eingesetzt werden. Die App nutzt dann das eingebaute GPS und vereint in sich sowohl die Client- als auch die Server-Funktionen. Bei Bedarf kann die Anbindung an die Netzwerke auf dem Boot über Wifi oder über USB erfolgen. Diese Lösung eignet sich hervorragend für kleinere Boote, Chartersegler, die ihr eigenes System mitbringen möchten, oder einfach als Backup-System in der Schublade. Auch hier greift übrigens das Server-Konzept: das Android-Gerät kann gleichzeitig als Server für andere Geräte an Bord dienen.

## Windows oder Linux
Schließlich gibt es noch die Möglichkeit, AvNav auf einem normalen PC oder Laptop unter [Windows](../installation/windows.md) oder [Linux](../installation/linux.md) zu installieren. Das ist vor allem für jene praktisch, die im Winter zu Hause am großen Bildschirm ihre Törns planen, Wegepunkte sortieren oder neue Seekarten generieren möchten. Später lassen sich die fertigen Pläne ganz einfach auf das System an Bord übertragen. Auch als Fallback-Lösung auf dem Laptop am Kartentisch ist ein solches Setup hervorragend geeignet.

Egal auf welchen Weg die Entscheidung fällt, die Benutzeroberfläche und die Bedienung im Browser sehen immer gleich aus. Man muss sich beim Umstieg zwischen den verschiedenen Betriebsystem-Versionen also nicht umgewöhnen.

