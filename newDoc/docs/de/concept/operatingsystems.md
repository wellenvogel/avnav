# Betriebssysteme

Dank seiner Client-Server-Architektur lässt sich AvNav auf einer Vielzahl von Geräten nutzen. Bevor Du mit der Installation beginnst, stehst Du vor der Entscheidung, welche Plattform für Deine individuellen Bedürfnisse am besten geeignet ist. Grundsätzlich gibt es drei typische Szenarien.

## Raspi OS 
Die von vielen Nutzern bevorzugte Lösung ist der Einsatz als Komplettsystem auf Basis eines Raspberry Pi, einem kleinen, preiswerten Linux-Minicomputer. Dieses Szenario ist ideal für Bootseigner, die ein dediziertes, zuverlässiges System anstreben. Dieser Ansatz basiert in der Regel auf zwei Möglichkeiten: entweder nutzt Du das speziell vorkonfigurierte AvNav-Image oder Du installierst AvNav als Zusatz auf einem bestehenden OpenPlotter-Image. Als "Image" werden dabei Softwarepakete bezeichnet, welche nicht nur die Anwendung selbst, sondern gleich das ganze darauf abgestimmte Betriebssystem enthalten.

Entscheidest Du Dich für das AvNav-Image, ist die Nutzung flexibel: Du kannst den Raspberry Pi als reinen Server ("headless") betreiben, der unsichtbar unter Deck arbeitet und ein eigenes WLAN-Netz aufspannt. Für die Anzeige im Cockpit verwendest Du dann einfach ein oder mehrere handelsübliche Tablets, die sich drahtlos mit diesem Zentralrechner verbinden. Alternativ kannst Du ihn aber auch als Komplettlösung mit direkt angeschlossenem Bildschirm und optional auch Maus und Tastatur nutzen. 

Fest unter Deck installiert und direkt an das 12-Volt-Bordnetz sowie an alle Bootsinstrumente angeschlossen, läuft der Raspberry Pi oft die gesamte Zeit über ununterbrochen durch. Er verbraucht dabei extrem wenig Strom. Wenn Du AvNav als dauerhafte, zentrale Navigationslösung nutzen möchtest, ist dies der empfohlene Weg.

## Android
Eine sehr beliebte Alternative ist die Nutzung von AvNav als Android-App. Dies ist der schnellste und unkomplizierteste Einstieg. Wenn Du ein Android-Tablet besitzt, kannst Du AvNav dort installieren und das Tablet als völlig eigenständiges System ("Standalone") einsetzen. Die App nutzt dann das eingebaute GPS des Tablets und vereint in sich sowohl die Client- als auch die Server-Funktionen. Diese Lösung eignet sich hervorragend für kleinere Boote, Chartersegler, die ihr eigenes System mitbringen möchten, oder einfach als Backup-System in der Schublade. Auch hier greift übrigens das Server-Konzept: das Android-Tablet kann gleichzeitig als Server für andere Geräte an Bord dienen.

## Windows oder Linux
Schließlich gibt es noch die Möglichkeit, AvNav auf einem normalen PC oder Laptop unter Windows oder Linux zu installieren. Das ist vor allem dann praktisch, wenn Du im Winter zu Hause am großen Bildschirm Deine Törns planst, Wegpunkte sortieren oder neue Seekarten generieren möchtest. Später lassen sich die fertigen Pläne ganz einfach auf das System an Bord übertragen. Auch als Fallback-Lösung auf dem Laptop am Kartentisch ist ein solches Setup hervorragend geeignet.

Egal für welchen Weg Du Dich entscheidest, die Benutzeroberfläche und die Bedienung im Browser sehen immer exakt gleich aus. Du musst Dich also nicht umgewöhnen, wenn Du von der Android-Version auf ein Raspberry-Pi-System umsteigst.

