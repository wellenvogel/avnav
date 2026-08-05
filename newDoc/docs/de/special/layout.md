# Details zu Layouts

Eine Einführung zu Layouts mit einem Video findet man [hier](../base/layout.md).

## Formatierer (Formatter) {: #formatter}

Die meisten Widgets benötigen für die Darstellung einen Formatierer, der
den internen Wert in die gewünschte Darstellung wandelt. Meist ist der
beim Widget fest vorgegeben. Einige Formatierer akzeptieren Parameter um
ihr Verhalten anzupassen (z.B. m/s statt kn).

Die Parameter für einen Formatierer sind im Dialog mit dem Prefix "fmt:"
sichtbar - "fmt:unit" im Beispiel.  
Die Liste der verfügbaren Parameter wird in der Implementierung des
Formatierers definiert (siehe [Benutzer
Formatierer](userjs.md#formatter)).

Wenn ein Formatierer einen "unit" Parameter ha, wird der Wert dieses
Parameter benutzt, um ihn als "unit" in der Anzeige darzustellen (Einige
Anzeigen erlauben ein Überschreiben dieses Wertes im Dialog).

Die folgenden Formatierer sind vorhanden:

|  |  |  |
| --- | --- | --- |
| Name | Beschreibung | Parameter |
| formatDecimal | einfache Formatierung als Dezimalzahl | fix: minimale Zahl der ganzzahligen Ziffern  fract: Zahl der Ziffern nach dem Komma  addSpace: setze ein Leerzeichen vor positive Zahlen  prefixZero: setze 0 als Prefix, um die Zahl der Vorkommastellen zu erreichen |
| formatDecimalOpt | Formatierung einer Dezimalzahl. Nachkommastellen werden nur für nicht ganzzahlige Werte dargestellt. | wie bei formatDecimal |
| formatDistance | Entfernung in nm|m|km | unit:  nm - Enterfnung in nm  m - Entfernung in m statt nm  km - Entfernung in km statt nm |
| formatSpeed | Geschwindigkeit in kn|m/s|km/h | unit:  kn - knoten  ms - m/s statt kn  kmh - km/h statt kn |
| formatDirection | Formatiere einen Gradwert | inputRadian: - Input in rad statt Grad  range180: zeige +/- 180° statt 0...360°  leadingZero: zeige immer 3 Stellen |
| formatDirection360 | Formatiere einen Gradwert | leadingZero: zeige immer 3 Stellen |
| formatTime | Formatiere einen Zeitwert (Wert muss intern ein Date Wert sein) (hh:mm:ss) |  |
| formatClock | Formatiere einen Zeitwert (Wert muss intern ein Date Wert sein) (hh:mm) |  |
| formatDateTime | Formatiere Datum und Uhrzeit (Wert muss intern ein Date Wert sein) |  |
| formatDate | Formatiere Datum (Wert muss intern ein Date Wert sein) |  |
| formatString | gibt den Input unverändert weiter |  |
| formatTemperature | Formatiere eine Temperatur (seit 20210106), Input in Kelvin | unit:  celsius, kelvin |
| formatPressure | Formatiere einen Druck (seit 20210106), input in Pa | unit:  pa, hpa, bar |

Plugins oder eigene Erweiterungen können ggf. weitere Formatierer
hinzufügen.

