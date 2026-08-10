---
  tags:
    - Erweiterungen
    - JavaScript
---

# Nutzer JavaScript Code

Um eine einfache Möglichkeit zu bieten, AvNav an seine Bedürfnisse
anzupassen, kann man mit ein wenig Java Script Code AvNav relativ einfach
erweitern.
Die möglichen Erweiterungen werden in den folgenden Kapiteln beschrieben.
Prinzipiell kann man beliebigen Java Script Code ausführen - muss dabei aber natürlich zusehen, die Funktionen von AvNav nicht zu stören.

Die in diesem Dokument beschriebenen Funktionen stehen sowohl dem Nutzer-JavaScript-Code zur Verfügung als auch dem JavaScript-Code in Plugins.

Der Java Script Code liegt bei den [Nutzerdateien](userfiles.md) in der Datei **user.mjs**. Diese Datei ist ein [JavaScript Modul](https://developer.mozilla.org/de/docs/Web/JavaScript/Guide/Modules) und wird von AvNav am Ende seines Start-Prozesses geladen. 
Der Hauptinhalt dieser Datei ist eine exportierte Funktion, die von AvNav nach dem Laden aufgerufen wird. Der Parameter "api" ist das [AvNav interface](https://github.com/wellenvogel/avnav/blob/master/viewer/api/api.interface.ts) das durch den Code genutzt werden kann.

Ein minimaler Inhalt der Datei könnte so aussehen:

``` js
export default (api)=>{
    api.log("Hello world);
}
```

??? "Kompatibilität zu früheren Versionen - user.js"
    In früheren Versionen befand sich der JavaScript code in einer Datei user**.js**. Das war eine einfache JavaScript Datei (kein Modul). 
    Das neue Handling mit user.mjs hat einige Vorteile:
    
    * automatisches Neu-Laden bei Änderungen
    * erweitertes API (mehr Funktione möglich)
    * es können weitere Module geladen werden.
    
    Falls AvNav durch ein Update installiert wurde und eine alte user.js Datei existiert, wird diese weiter genutzt. Das zur Verfügung stehende API entält allerdings nur einen Teil der Funktionen des aktuellen APIs.
    Da diese Date in der aktuellen Version ebenfalls über ein JavaScript Modul geladen wird und Module strikteren JavaScript code verlangen, kann es zu Fehlern beim Laden der Datei kommen. Dann muss man seinen Code ggf. [anpassen](https://developer.mozilla.org/de/docs/Web/JavaScript/Guide/Modules#andere_unterschiede_zwischen_modulen_und_klassischen_skripten).
    Die alte Beschreibung für die user.js ist [hier](userjs-legacy.md) verfügbar.
    Falls sowohl eine user.mjs (neu) als auch eine user.js (alt) vorhanden sind, wird nur die user.mjs geladen.

## Bearbeiten der Datei user.mjs
Über 

{{MM("addonconfigpage")}}->{{BT("AddonConfigUser")}}

erreicht man die Liste der Dateien im Nutzerverzeichnis. Nach Klick auf die Datei "user.mjs" und {{DB("Edit")}} wird ein Editorfenster geöffnet, in dem man den Code bearbeiten kann.
Um effektiv arbeiten zu können, empfiehlt es sich, mit zwei Browser-Fenstern oder Tabs zu arbeiten - in einem Fenster hat man den Editor geöffnet, im anderen Fenster AvNav noch einmal in dem Bereich, den man testen möchte. Beim Specihern der Datei im Editor-Fenster wird diese im Hintergrund sofort in allen offenen AvNav Fenstern neu geladen und wird direkt wirksam.

Der Editor hat eine Syntax-Anzeige für JavaScript, so das man bereits bis zu einem gewissen Grad die Korrektheit des Codes sehen kann.

Für die Arbeit an der Datei sollte man in dem Browser-Fenster, in dem man testet, die Entwickler-Werzeuge öffnen und dort die "Konsole" sichtbar haben. Fehler im JavaScript Code werden dort ausgegeben.

Wenn man die Bearbeitung beendet hat, sollte man AvNav in allen Browser-Fenstern neu laden (einen Hinweis darauf bekommt man durch das rote Icon {{ICON("JSChanged")}} in der Titelzeile - ein Klick darauf führt zu einem Dialog für das Neu-Laden).

In der vom System angelegten user.mjs Datei befinden sich bereits einige Beispiele, die man durch Entfernen von Kommentarzeichen aktivieren kann.

Das aktuelle Template kann man auch [auf
github](https://github.com/wellenvogel/avnav/blob/release-{{config.extra.version}}/viewer/static/user.mjs) finden.

## Formatierer (Formatter) { #formatter }

Ein typischer Anwendungsfall für einen neuen Formatter ist die Anzeige eines bisher nicht bekannten Wertes über das Default Widget (siehe [Layouts](layout.md)).
Das könnte z.B. ein über einen XDR Datensatz empfangener Lade- oder Entladestrom sein. In den Daten ist der Wert in A, wir möchten den Wert aber gerne in % eines Maximalwertes anzeigen lassen.
Dazu können wir den folgenden Code nutzen:
``` js
const formatAmperePercent=(val)=>{
  const max=50; //fix max
  if (isNaN(val)) return "-----";
  const percent=Number(val)*100/50;
  return percent.toFixed(0)+"%";
}
api.registerFormatter("formatAmperePercent",formatAmperePercent);
```
Wenn wir diesen Formatter so in unsere user.mjs geschrieben haben, können wir nun sofort im Layout Editor den Formatter nutzen indem wir das Default Widget auswählen, unter "value" den anzuzeigenden Wert selektieren und unter "formatter" unseren formatAmperePercent auswählen.

Natürlich ist das so noch nicht besonders komfortabel - der Maximalwert ist fest kodiert. Wenn wir wollen, das der Maximalwert im Layout Editor auswählbar wird, müssen wir noch Parameter für unseren Formatter festlegen.
Wir definieren nur einen Parameter "maxCurrent".

``` js
const formatAmperePercent=(val,max)=>{
  if (isNaN(val)) return "-----";
  if (! max) max=50;
  const percent=Number(val)*100/max;
  return percent.toFixed(0)+"%";
}
formatAmperePercent.parameters=[
  {
    name: "maxCurrent",
    type: "FLOAT",
    default: 50,
    description: "Maximal current for computing the percentage"
  }
]
api.registerFormatter("formatAmperePercent",formatAmperePercent);
```
Die Parameter für einen Formatter werden ähnlich beschrieben, wie [Widget Parameter](#widgetparameters), nur das sie als Array angegeben werden mit einem zusätzlichen Feld "name"
Wenn wir num im Layout-Editor unseren Formatter nutzen, sieht das Bild so aus:

![Formatter](../../img/userjs-formatter.png)
///caption
Formatter mit Paremetern
///

Und das Resultat dann (unteres Widget):

![Formatter Result](../../img/userjs-formatter2.png)
///caption
Formatter Resultat
///
Falls wir nun mit der einfachen JavaScript "toFixed" Funktion nicht zufrieden sind, können wir natürlich stattdessen auch einen der bereits [vorhandenen Formatter](layout.md#formatter) verwenden.
Wir möchten hier 3 Stellen haben und verwenden formatDecimal.
``` js
...
return api.formatter.formatDecimal(percent,3)+"%";
```

## Anzeigen (Widgets) {: #widgets}

Man kann die folgenden Arten von Anzeigen hinzufügen:

* Widgets mit eigenem [Formatter](#formatter) (und ggf. festen Werten) basierend auf
  dem Default Widget (Beispiel 1 - [user.mjs](https://github.com/wellenvogel/avnav/blob/master/viewer/static/user.mjs):  rpmWidget)
* Anpassung/Erweiterung der Grafik Widgets mit [canvas
  gauges](https://canvas-gauges.com/) (Beispiel 2 - [user.mjs](https://github.com/wellenvogel/avnav/blob/master/viewer/static/user.mjs)
  rpmGauge)  
  Hiermit ist es auch möglich, Parameter zugänglich zu machen, die in den
  bisher vorhandenen Widgets nicht enthalten sind
* Widgets mit eigenem HTML code (Beispiel 3 - [user.mjs](https://github.com/wellenvogel/avnav/blob/master/viewer/static/user.mjs):
  userSpecialRpm)
* Widgets mit Grafik in einem Canvas Element (Beispiel im [TestPlugin:](https://github.com/wellenvogel/avnav/blob/master/server/plugins/testPlugin/plugin.js)
  testPlugin\_courseWidget)
* Widgets mit eigenem HTML, die mit dem Server Teil eines Plugins
  interagieren ([TestPlugin](https://github.com/wellenvogel/avnav/blob/master/server/plugins/testPlugin/plugin.js):
  testPlugin\_serverWidget)
* Widgets, die Grafiken auf der Karte darstellen (type: `map`) z.B. [SailInstrument](https://github.com/kdschmidt1/Sail_Instrument/blob/e1d87186138e5a3ac894916e9b7e85a3218a4c9a/Sail_Instrument/plugin.js#L223)

Das Interface, über das mit AvNav kommuniziert wird, findet sich [auf
github](https://github.com/wellenvogel/avnav/blob/master/viewer/api/api.interface.ts).
Für map Widgets kann über das Api auf die [zugrunde
liegenden Bibliotheken](https://www.movable-type.co.uk/scripts/geodesy-library.md) für geografische Berechnungen zugegriffen
werden (Funktion LatLon und Dms).

### Canvas Gauges

Für [Canvas Gauge](https://canvas-gauges.com/) Widgets können
bestimmte Parameter (siehe [Canvas
Gauges Beschreibung](https://canvas-gauges.com/documentation/user-guide/configuration)) entweder auf feste Werte gesetzt werden (dann
müssen sie in der Widget Definition vorhanden sein - siehe die Werte im [Beispiel](https://github.com/wellenvogel/avnav/blob/master/viewer/static/user.mjs)) oder sie können für den Nutzer im Layout Editor
einstellbar gemacht werden (dann müssen sie als [WidgetParameter](#widgetparameter) gesetzt werden.

Ausserdem kann eventuell ein [eigener Formatter](#formatter)
definiert werden und als default für das Widget gesetzt werden.

Wenn man für bestimmte [vordefinierte
Parameter](#predefinedparameters) vermeiden möchte, das sie im Layout Editor für den Nutzer
sichtbar werden, müssen sie in den editable Parameters mit false angegeben
werden.

``` js
var rpmGaugeUserParameter = {
...
formatter: false,
formatterParameters: false
};
```

Für jedes gauge widget muss der Parameter "type" angegeben werden -
entweder "radialGauge" oder "linearGauge".  
Ausserdem haben sie den zusätzlichen Parameter

``` js
drawValue (boolean)
```

Dieser Parameter steuert, ob auch eine numerische Anzeige des Wertes
erfolgen soll. Der originale "valueBox" Parameter der canvas gauges wird
ignoriert!

Neben den Parametern kann auch noch eine translateFunction definiert
werden. Diese erhält als Parameter ein Objekt mit den aktuellen Werten
aller Parameter und kann dieses modifizieren, bevor sie an canvas gauges
übergeben wird.
Diese Funktion muss "zustandsfrei" sein, d.h. die
Werte der Rückgabe dürfen nur von den übergebenen Werten (und anderen
unveränderlichen Werten) abhängig sein. Andernfalls werden potentiell
Änderungen nicht in der Anzeige sichtbar.

### Eigene Widgets

Für ein selbst geschriebenes Widget können die folgenden
Funktionen/Eigenschaften implementiert werden:

| Name | Typ | Nutzbar bei Typ | Beschreibung |
| --- | --- | --- | --- |
| name | String | alle | der Name des Widgets |
| type | String  (optional) | alle | Bestimmt, welches Widget erzeugt werden soll.  Werte: radialGauge, linearGauge, map  Wenn der Typ nicht gesetzt ist, wird entweder das default widget genutzt (keine Funktion renderHtml und keine Funktion renderCanvas angegeben) - oder ein nutzer definiertes Widget (userWidget) |
| renderHtml { #renderhtml } | Funktion  (optional) | userWidget | Diese Methode muss [HTML](#htmlcode) zurückgeben, das dann in das Widget eingebaut wird.  Das als Parameter an renderHtml übergebene Objekt enthält die unter storeKeys und parameters definierten Werte.  Die Funktion wird jedesmal erneut aufgerufen, wenn sich die Werte geändert haben.     Die "this" variable innerhalb von renderHtml zeigt auf ein Objekt, das spezifisch für das Widget ist ([Kontext](#widgetcontext)). |
| renderCanvas | Funktion  (optional) | userWidget,  map | Mit dieser Funktion kann in das übergebene Canvas Objekt gezeichnet werden.  Das als zweiter Parameter an renderCanvas übergebene Objekt enthält die unter storeKeys und parameters definierten Werte.  Die Funktion wird jedesmal erneut aufgerufen, wenn sich die Werte geändert haben.  Die "this" variable innerhalb von renderCanvas zeigt auf ein Objekt, das spezifisch für das Widget ist ([Kontext](#widgetcontext)).  Für map widgets ist dieser Canvas ein Overlay, das über die Karte gelegt wird. Am Widget Kontext stehen Funktionen zur Umrechnung von Koordinaten in Canvas Pixel bereit.   Es ist wichtig den Canvas korrekt mit save/restore zu beschreiben, da sich alle map widgets den gleichen Canvas teilen. |
| storeKeys | Object | alle | Hier müssen die Daten angegeben werden, die aus dem zentralen Speicher gelesen und als Parameter den renderXXX Funktionen mitgegeben werden sollen. Siehe [Store](#store) |
| caption | String  (optional) | alle | Eine default Beschriftung |
| unit | String  (optional) | alle | Eine default Einheit |
| formatter | Funktion  (optional) | defaultWidget,  radialGauge, linearGauge | Ein Formatierer für den Wert. Für das defaultWidget muss diese Funktion angegeben werden. |
| translateFunction | Funktion  (optional) | alle ausser map | Diese Funktion wird mit den aktuellen Werten als Parameter aufgerufen (so wie bei storeKeys angegeben) und muss die daraus berechneten Werte zurückgeben.  Falls keine eigene renderXXX Funktion genutzt werden soll, kann hier vor dem Rendern eine Umrechnung von Werten erfolgen |
| initFunction { #initfunction } | Funktion  (optional) | userWidget,  map | Falls vorhanden, wird diese Funktion einmalig aufgerufen, wenn das Widget erzeugt wird. Als Parameter (und als this) ist der Widget Context vorhanden.  Dieses Objekt hat eine eventHandler Eigenschaft - hier müssen die im renderHTML genutzten eventHandler eingetragen werden.  Mit der Funktion triggerRedraw am Widget Kontext kann ein erneuter Aufruf der renderXXX Funktionen erzwungen werden. Der  2. Parameter enthält die Eigenschaften des Widgets. Das sind insbesondere auch alle editierbaren Widget Parameter, die definiert wurden. |
| finalizeFunktion | Funktion  (optional) | userWidget,  map | Falls vorhanden, wird diese Funktion aufgerufen, bevor das Widget nicht mehr genutzt wird. Die "this" Variable zeigt wieder auf den Widget Kontext.  Ausserdem ist der Kontext auch als erster Parameter vorhanden - wie bei der initFunction. |

Nach der Definition muss das Widget bei AvNav bekannt gemacht werden
(api.registerWidget).

### Widget Context { #widgetcontext }

User Widgets und Map Widgets bekommen einen WidgetContext. Dieser wird
für jedes Widget erzeugt und den Funktionen:

* initFunction (this und erster Parameter)
* finalizeFunction (this und erster Parameter)
* renderHtml (this)
* renderCanvas (this)

übergeben.  
Damit der Kontext als this Parameter genutzt werden kann, müssen die
Funktionen "klassisch" mittels function definiert werden und nicht als
"arrow function".

Richtig:

``` js
let userWidget={  
 renderHtml: function(context,props){  
 return "<p>Hello</p>";  
 }  
}
```

Im WidgetContext können Nutzerdaten gespeichert werden, die in
aufeinanderfolgenden Aufrufen benötigt werden.  
Ausserdem enthält er einige Funktionen, die vom Widget Code aufgerufen
werden können.

| Name | Widget | Parameter | Beschreibung |
| --- | --- | --- | --- |
| eventHandler | userWidget | --- | eventHandler ist keine Funktion sondern ein array. Falls im [renderHtml](#htmlastext) event Handler angegeben werden dann muss in der initFunction  eine Funktion mit diesem Namen hier registriert werden. |
| triggerRedraw | userWidget | --- | Diese Funktion muss gerufen werden, wenn das Widget (z.B. nach einer Kommunikation mit dem Server) möchte, das es neu gezeichnet wird. |
| lonLatToPixel | map | lon,lat | Konvertiert die Koordinaten in pixel Koordinaten für das Zeichnen in renderCanvas.  Gibt ein array mit x,y Koordinate zurück. |
| pixelToLonLat | map | x,y | Berechnet aus den Canvas-Koordinaten x,y longitude und latitude. Gibt ein array mit lon,lat zurück. |
| getScale | map | --- | Gibt den Scaling Faktor für das Display zurück. Hochauflösende Display haben einen scaling Factor > 1. Gezeichnete Objekte (besonders Text) sollten in ihren Dimensionen angepasst werden. |
| getRotation | map | --- | Gibt die Drehung der Karte (in radian!) zurück |
| getContext | map | --- | Gibt den renderingContext2D des Canvas zurück (nur aktiv innerhalb der renderCanvas Funktion) |
| getDimensions | map | --- | gibt die Größe des Canvas zurück [Breite,Höhe] |
| triggerRender | map | --- | gleiche Funktion wie triggerRedraw beim user Widget |

### Widget Parameter {: #widgetparameter}

Neben der Widget Definition können beim registrieren des Widgets noch
Parameter angegeben werden, die dann im Layout Editor für das Widget
angezeigt werden.

Beispiele sind im [user.mjs
Template](https://github.com/wellenvogel/avnav/blob/master/viewer/static/user.mjs) zu finden. Die Werte, die im Layout Editor für diese
Parameter angegeben werden, stehen später in den renderHtml und
renderCanvas Funktionen zur Verfügung (Ausnahme: Typ KEY, hier wird
der  aus dem Speicher gelesene Wert zur Verfügung gestellt). 


Für jeden Parameter kann man die folgenden Werte angeben:

| Name | Type | Beschreibung |
| --- | --- | --- |
| type | String | `STRING, NUMBER,FLOAT, KEY, SELECT, ARRAY, BOOLEAN, COLOR`  Der Typ für den Parameter. Je nach Typ wird er dem Nutzer unterschiedlich angezeigt.  Für COLOR eine Farb-Auswahl, für SELECT eine AuswahlListe und für KEY die Liste der momentan verfügbaren Werte im Store.  Für ein Array kann eine durch Komma getrennte Liste angegeben werden. |
| default | je nach type | Der default Wert.   Für COLOR eine color css Property - also z.B. "rgba(200, 50, 50, .75)" |
| list | Array  (nur für type SELECT) | Ein Array von Strings oder von Objekten {name:'xxx',value:'yyy'} - diese Werte werden  zur Auswahl angezeigt.  Statt eines Arrays kann auch eine Funktion angegeben werden, die ein Array zurückgibt - oder eine Funktion, die eine Promise zurückgibt, deren resolve Funktion dann das Array liefert. |
| description | string | Eine Beschreibung des Wertes für den Nutzer |
| condition | Object oder Array von Objecten | Ein Object mit Werten für andere Parameter. Nur wenn die anderen Parameter den entsprechenden Wert haben, wird der Parameter angezeigt. Wenn ein Array angegeben ist, werden die einzelnen Element oder-verknüpft. Beispiel ` condition:{kind:'all'}`. Der Parameter wird nur angezeigt, wenn der Parameter "kind" den Wert "all" hat.


Es gibt eine
Reihe von vordefinierten Parametern für den Layout Editor. Bei diesen wird
zur Beschreibung kein Objekt mit Eigenschaften angegeben, sonder nur true
oder false (das zeigt, ob sie zum Ändern angeboten werden sollen oder
nicht).

Das sind:

* caption (STRING)
* unit (STRING)
* formatter (SELECT)
* formatterParameters (ARRAY)
* value (KEY)
* className (STRING)

Ein Beispiel für eine Definition:
``` js
var exampleUserParameters = {
//formatterParameters is already well known to avnav, so no need for any definition
//just tell avnav that the user should be able to set this
formatterParameters: true,
//we would like to get a value from the internal data store
//if we name it "value" avnav already knows how to ask the user about it
value: true,
//we allow the user to define a minValue and a maxValue
minValue: {type: 'NUMBER', default: 0},
maxValue: {type: 'NUMBER', default: 4000},
};
```

## Bibliotheken und Bilder

Falls der eigene Java Script code auf Bibliotheken oder Bilder zugreifen
soll, können diese in das gleiche Verzeichnis hochgeladen werden - Images
auch in das Images {{BT("AddonConfigImages")}}Verzeichnis.

Bibliotheken, die sich im Nutzerdaten-Verzeichnis befinden, können einfach mit
``` js
import './libtest.js';
```
geladen werden.
Falls die Bibliotheken ihre Funktionen als Module anbieten, findet man in der Beschreibung, welche imports genutzt werden können.
``` js
import test from './libtest.js';
```
Für einen default export.

Es empfiehlt sich, für alle Widgets css Klassen zu vergeben, damit man
diese dann mit [nutzerspezifischem CSS](usercss.md) anpassen
kann. IDs sollten nicht verwendet werden, da die Elemente potentiell
mehrfach auf der Seite auftauchen können.

Falls Daten vom Server geladen werden sollen, empfiehlt sich die
Verwendung von [fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch).
Alle Dateien im user Verzeichnis (oder im plugin Verzeichnis für
plugin.js)  sind nach dem Schema `api.getBaseUrl()+"/"+name` abrufbar.


## Feature Formatierer(featureFormatter) {: #featureFormatter }

Es gibt die Möglichkeit, eigene Funktionen zu
registrieren, die die Anzeige von Daten aus Overlays aufbereiten.  
Solche Funktionen können in der user.mjs oder in Plugins implementiert
werden.

Mit

``` js
api.registerFeatureFormatter('myHtmlInfo',myHtmlInfoFunction);
```

werden sie registriert.
Diese Java Script Funktion bekommt als Parameter die in der Overlay Datei
vorhandenen Eigenschaften des angeklickten Punktes und kann
veränderte/neue Eigenschaften zurückgeben, die dann vom FeatureInfo Dialog
angezeigt werden.

Die folgenden Eigenschaften können zurückgegeben werden:

| Name | Bedeutung |
| --- | --- |
| sym | die URL für ein anzuzeigendes Icon. Das kann eine relative URL sein, diese ist dann eine Icon Datei innerhalb der [konfigurierten](TODO: overlay config) userIcons Datei, ein absoluter Pfad wie z.B. /user/images/myImage.png oder eine mit http: beginnende externe URL (natürlich dann nur mit Internet Verbindung nutzbar). |
| name | der anzuzeigende Name |
| desc | der unter "description" anzuzeigende Text |
| htmlInfo | ein html String, der dann bei Klick auf den {{DB("DBInfo")}} Button angezeigt wird. |
| time | eine Zeitangabe (String oder java script Date) |
| link | eine URL, die bei Klick auf den {{DB("DBInfo")}} Button angezeigt werden soll (alternativ zu htmlInfo). Es gelten die gleichen Regeln wie für "sym". |

Die übergebenen Parameter hängen von der Overlay Datei ab. Zusätzlich
sind in jedem Falle die Werte "lat" und "lon" vorhanden.

Ein Beispiel für die [eingebaute
genericHtmlInfo](https://github.com/wellenvogel/avnav/blob/master/viewer/util/featureFormatter.js) Funktion, die alle vorhandenen Werte als HTML in den
Wert htmlInfo schreibt.

``` js
let genericHtmlInfo=function(properties,extended){
if (! extended) return {};
let htmlInfo='<div class="featureInfoHtml">';
for (let k in properties){
if (!properties[k]) continue;
if (htmlInfo !== "") htmlInfo+="<br/>";
htmlInfo+=avnav.api.escapeHtml(k)+"="+avnav.api.escapeHtml(properties[k]);
}
htmlInfo+='</div>';
return {htmlInfo:htmlInfo};
}
```

Der zweite Parameter, der an die Funktion übergeben wird, gibt einen
Hinweis, ob alle Parameter erzeugt werden sollen oder nur der "sym"
Parameter. Falls extended auf "false" gesetzt ist, sollte die Funktion
keine zeitraubenden Operationen ausführen, da sie potentiell für jedes
Element aus dem Overlay aufgerufen wird.

Nachdem eine solche Funktion registriert wurde, kann sie für ein Overlay in der [Konfiguration](TODO: overlay config) ausgewählt werden.


## Kartenlayer (User Map Layer) {: #usermaplayer }

Über die Funktion
``` js
api.registerUserMapLayer(baseName,name,callback)
```
können eigene Karten-Layer-Typen registriert werden. Eine Beschreibung findet man unter [Kartendetails](charts.md#extensions).

## HTML Code { #htmlcode }

An verschiedenen Stellen (bei [Widgets](#widgets), [Dialogen](#dialogs)) kann HTML code an das API übergeben werden. Dafür gibt es die folgenden Möglichkeiten:

### Text { #htmlastext }
Das ist die auch bereits in allen älteren AvNav Versionen verfügbare Variante. Hier wird einfach der HTML code als Text übergeben.
` <div class="test">Test</div>`.
In JavaScript kann man dazu recht gut [Template Strings](https://developer.mozilla.org/de/docs/Web/JavaScript/Reference/Template_literals) verwenden.

``` js
const v=99:
return `<div class="value">${v}</div>`
```
Falls man interaktive Elemente einbauen möchte, geht das nur bei [eigenen Widgets](#renderhtml).
EventHandler für Elemente müssen vorher registriert werden (siehe [initFunction](#initfunction)) und werden im HTML code einfach mit  ``` <button onclick="myHandler">Click!</button> ``` angegeben (das ist keine exakte HTML Syntax, da nur der Name des event handlers angegeben wird, kein java script code). Wenn der EventHandler aufgerufen wird, zeigt this auf den Widget-Kontext.

### ReactJs { #htmlreact }
AvNav selbst ist unter Nutzung von [ReactJS](https://react.dev/) geschrieben. Um dem Nutzer erweiterte Möglichkeiten beim Einbringen von eigenem Code zu bieten, kann HTML auch als [ReactNode](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/9a3935d14fd94421a5c599b968365543c4f1fb2f/types/react/v18/index.d.ts#L486) zurückgegeben werden.
Da für den Nutzer-JavaScript Code kein JSX Parser bereitsteht, und das Erzeugen der React-Objekte in purem JavaScript Code mühsam ist, bietet AvNav hier Support für [HTM](https://github.com/developit/htm).
Um das zu nutzen muss man die entsprechenden Module am Anfang der user.mjs Datei importieren.
``` js
import html from '/modules/htm.js';
```
Ein simples Widget, das eine wiederverwendbare Componente Value zur Anzeige nutzt, kann dann so aussehen:
``` js
//a simple React component that will render a div with the class "value"
//and display the parameter "v" inside
const Value=({v})=>html`<div class="value">${v}<//>`

//a simple widget that will render the value of the selected
//store key using the Value component
const HTMWidget={
  name:'HTMWidget',
  renderHtml:(props)=>{
    return html`<${Value} v=${props.value}><//>`
  }
}
const HTMParameters={
  value:{
    type:"KEY",
  }
}
api.registerWidget(HTMWidget,HTMParameters);
```
Unter Nutzung von React Funktionen ist es auch sehr viel einfacher z.B. einen Klick-Handler einzubauen.

``` js
const Value=({v})=>{
   const clickHandler=(ev)=>alert("Value:"+v);
   return html`<div class="value" onClick=${clickHandler}>${v}<//>`
}
```
Es stehen alle ReactJS Funktionen zur Verfügung. Die nötigen Module lassen sich über entsprechende Imports hinzufügen. Ausserdem stehen auch einige AvNav GUI Elemente über Imports zur Verfügung. 
Die bereitgestellten Module finden sich im [Code](https://github.com/wellenvogel/avnav/tree/master/viewer/exportmodules).
Wenn man z.B. [ListItem](https://github.com/wellenvogel/avnav/blob/66f12023f6f863fcbb24d18efe1ed40494421782/viewer/exportmodules/avnavui.js#L36) von den AvNav Modulen importieren möchte, schreibt man im code
``` js
import {ListItem} from '/modules/avnavui.js`;
```

Einige Beispiele zur Nutzung kann man in einem [AvNav eigenen Plugin](https://github.com/wellenvogel/avnav/blob/master/raspberry/network-nm/plugin/plugin.mjs) zur Netzwerk-Verwaltung sehen. 

## AvNav Navigationsdaten (Store) {: #store }

Um Anzeigen dynamisch an geänderte Werte anzupassen, verfolgt AvNav ein "Store" Konzept. In diesem Store werden Daten mit einem strukturierten Key und ihrem Wert gespeichert. Ein solcher Key ist z.B. `nav.gps.lat` für die aktuelle Länge der GPS Position. Die innerhalb von AvNav verwendeten Keys finden sich in [keys.ts](https://github.com/wellenvogel/avnav/blob/4ba19d53196a35ac46c0c38daebd1f59112981a9/viewer/util/keys.ts#L161).

Der AvNav store kann auf verschiedene Arten genutzt werden:
  
  1. Für dynamische Anzeigen

     An einigen Stellen (z.B. bei Widgets oder Buttons) kann man einen Paremeter `storeKeys` angeben. Dieser wählt einige der Werte im Store aus, die auf Änderungen überwacht werden sollen. Immer wenn sich diese ändern wird das entsprechende Element (also z.B. das Widget neu gezeichnet). Gleichzetig übersetzen die Einträge die strukturierten Keys in einfache.
     ``` js
     const storeKeys={
        lat:'nav.gps.lat',
        lon: 'nav.gps.lon'
     }

     const testWidget={
        name: 'testWidget',
        renderHtml: (props)=>return `<span>lat=${props.lat}, lon=${props.lon}</span>`,
        storeKeys: storeKeys
     }
     ```

     Die Werte `nav.gps.lat` und `nav.gps.lon` werden überwacht und an das Widget werden die Properties `lat` und `lon` übergeben.
     Die Elemente, die storeKeys akzeptieren, haben ausserdem einen Parameter `updateFunction`. Dieser erhält als Parameter die aktuell gelesenen Werte und kann veränderte Werte zurückgeben.
     
     ``` js
     const testWidget={
        ...
        updateFunction=(current)=> return {...current, valid: curren.lat != null && current.lon != null}
     }
     ```

     Dieses Beispiel gibt noch einen zusätzlichen Wert `valid` zurück, wenn `lat` und `lon` gültige Werte haben.
     Mit diesem Konzept lassen sich relativ flexibel die vorhandenen Elemente dynamisch nutzen.

  2. Direkter Zugriff
     
     Die [API-Funktionen](https://github.com/wellenvogel/avnav/blob/66f12023f6f863fcbb24d18efe1ed40494421782/viewer/api/api.interface.ts#L702)

     ``` ts
     getStoreBaseKey():string;
     getStoreData(key:string,defaultv?:StoreData):StoreData;
     setStoreData(key:string,data:StoreData):void;
     ```
     ermöglichen den zugriff auf den Store. Der lesende Zugriff auf die Store-Daten ist dabei für beliebige Keys möglich, der schreibende zugriff nur für Keys die mit dem Prefix beginnen, der von `getStoreBaseKey()`zurückgegeben wird. Damit wird sichergestellt das Plugins und Nutzer-Code nur ihre eigenen Daten in den Store schreiben können und nicht die Grundfunktionen von AvNav stören.

     Prinzipiell können beliebige Daten in den Store geschrieben werden, man muss jedoch aufpassen, wenn man z.B. Objekte in den Store schreibt und diese ändern möchte. Bei Änderungen muss man ein solches Objekt vorher kopieren und dann die Kopie in den Store schreiben, da AvNav sonst nicht erkennen kann, das sich der Wert geändert hat.

     Ein Anwendungsfall für einen eigenen Wert im Store kann beispielsweise die Steuerung der Sichtbarkeit oder des "disabled" Zustandes eines [User-Buttons](#dialogs) sein.

     Natürlich kann es auch für Anzeigen in einem [Widget](#widgets) genutzt werden - beispielsweise für Werte, die per fetch von einem Server geladen werden.

     ``` js
     const SKEY=api.getStoreBaseKey()+".TestButton";
     //initially disable the button
     api.setStoreData(SKEY,true);
     api.registerUserButton({
        name: 'test',
        shortText: 'Test',
        storeKeys: {
            disabled: SKEY
        }
        ...
     });
     //call this to enable the button
     const enableButton=()=>{
        api.setStoreData(SKEY,false)
     }
     ```
  3. In [React HTML-Code](#htmlreact)

     Hier steht eine Helper-Funktion bereit, die die AvNav Store Werte mit dem React State verknüpft, so das bei Änderungen auch die Komponente neu gezeichnet wird.

     ``` js
     import {useStoreState} from '/imports/avnavui.js';
     ....
     const StoreValue=({vkey})=>{
        const [current]=useStoreState(vkey,'not set');
        return html`<div className="value">${current}</div>`
     }

     ....
     const SKEY=api.getStoreBaseKey()+".TestValue";
     api.setStoreData(SKEY,1)
     const TestComp=()=>{
        return html`${StoreValue} vkey=${SKEY} <//>`
     }

     window.setInterval(()=>{
        api.setStoreData(SKEY,api.getStoreData(SKEY)+1);
     },1000)
     ```
     Dieses Beispiel zeigt den Wert aus dem Store mit der Komponente StoreValue bei jeder Änderung an.

## Dialoge und Buttons {: #dialogs }

AvNav bietet die Möglichkeit HTML Seiten oder externe Webseiten als [User Apps](../base/userapps.md) einzubinden. Daneben gibt es auch noch die Option Buttons auf bestimmte Seiten zu plazieren und mit diesen Buttons Aktionen auszulösen - z.B. Dialoge oder auch Aktionen in einem Plugin.

Das [API](https://github.com/wellenvogel/avnav/blob/master/viewer/api/api.interface.ts) bietet dazu einige Funktionen.

| Funktion | Beschreibung |
| --- | --- |
| [registerUserButton](https://github.com/wellenvogel/avnav/blob/66f12023f6f863fcbb24d18efe1ed40494421782/viewer/api/api.interface.ts#L669) | Registriere ein Button mit einer Callback-Funktion, die bei Click aufgerufen wird. |
| [showDialog](https://github.com/wellenvogel/avnav/blob/66f12023f6f863fcbb24d18efe1ed40494421782/viewer/api/api.interface.ts#L721) | Zeige einen Dialog an. |

### Buttons {: #userbutton }

Ein Button, der mit registerUserButton bekannt gemacht wird, hat die folgenden Eigenschaften (Details findet man im [API](https://github.com/wellenvogel/avnav/blob/66f12023f6f863fcbb24d18efe1ed40494421782/viewer/api/api.interface.ts#L525)): 

| Name | Typ | Beschreibung |
| --- | --- | --- |
| name | String | Name des Buttons. Der Name wird auch als CSS Klasse am Button gesetzt und kann dazu genutzt werden, im [CSS](usercss.md#buttons-icons) das Icon oder die Texte anzupassen |
| iconClass | String | Optional. Siehe API |
| shortText | String | Optional. Wenn nicht gesetzt sollte der Text per CSS gesetzt werden. |
| longText | String | Optional. Text für den Tool-Tip oder für den Button wenn er im Hauptmenü sichtbar ist. Alternativ per CSS. |
| icon | URL | Optional. Relative Icon-URL. Alternativ per CSS. |
| storeKeys | Objekt | Optional. Siehe [Store](#store). | 
| updateFunction | Funktion | Optional. Siehe [Store](#store). | 
| visible | Boolean | Optional. Wenn false wird der Button nicht angezeigt.|
| disabled | Boolean | Optional. Wenn true wird der Button disabled gesetzt. |
| toggle | Boolean | Optional. Wenn true wird der Button auf aktiv gesetzt. (Gründer Rand) |
| onClick | Funktion | Die Funktion, die bei Klick aufgerufen wird. |

Der `page` Parameter in `registerUserButton` ist die Seite, auf der der Button angezeigt werden soll. Die Liste der Seitennamen findet man im [Code](https://github.com/wellenvogel/avnav/blob/master/viewer/util/pageids.ts) - oder wenn man im Dialog für das Anlegen einer [User App](../base/userapps.md) die "page" auswählt.

Die `onClick` Funktion erhält als Parameter den ReactJS Klick-Event.

### Dialoge {: #dialogs }

Eine der Funktionen, die man durch einen Button auslösen kann, ist die Anzeige eines Dialogs.

AvNav bietet dazu die API Funktion [showDialog](https://github.com/wellenvogel/avnav/blob/66f12023f6f863fcbb24d18efe1ed40494421782/viewer/api/api.interface.ts#L721). Der übergebene Parameter vom Typ `DialogConfig` beschreibt den Dialog, der angezeigt werden soll. Die Funktion arbeitet asynchron (d.h. gibt eine Promise zurück). Der Resolve Wert  (bzw. der async Returnwert) ist eine Funktion, mit der man den Dialog wieder schliessen kann. Für viele Szenarien wird man das nicht benötigen. Der Dialog wird in jedem Fall geschlossen, wenn die Seite in AvNav verlassen wird.

Die Parameter des [DialogConfig](https://github.com/wellenvogel/avnav/blob/66f12023f6f863fcbb24d18efe1ed40494421782/viewer/api/api.interface.ts#L490) Objektes sind im API Code beschrieben.

Parameter die als Typ `string|React.ReactNode` haben, können wie unter [ReactJS](#htmlreact) beschrieben gefüllt werden. Falls der Dialog vor allem dazu dienen soll ein Formular mit Werte-Eingaben anzuzeigen, kann im Feld `parameters` ein Array von Parameter-Definitionen übergeben werden. Die Syntax entspricht den [Widget Parametern](#widgetparameter). Initiale Werte werden in `values` gesetzt (ein Objekt dessen Keys die Parameter-Namen sind). Falls der Nutzer einen Wert ändert, wird der `onChange` Callback gerufen.

Über den `buttons` Parameter wird eine Liste von anzuzeigenden Buttons angegeben. Die Elemente entsprechen weitgehend der Beschreibung unter [Buttons](#userbutton). Die `onClick` Funktion bekommt als zusätzliche Parameter die aktuellen Werte und eine Funktion zum Schliessen des Dialogs übergeben. Wenn sie (optional async - d.h. als Promise) ein Objekt zurückgibt, wird dieses als neue Parameterwerte interpretiert. 
Falls der Parameter `close` an einem Button nicht gesetzt (oder true) ist, wird der Dialog geschlossen.

``` js
const INITIALVALUES={
    testvalue:'to be changed'
}
let ivalues={...INITALVALUES}
api.showDialog({
    title: 'Test',
    parameters:[
        name: 'testvalue',
        type: 'STRING'
    ],
    buttons: [
        {
            name: 'reset',
            shortText: 'Reset',
            close: false,
            onClick:(ev,values)=> return INITIALVALUES
        },
        {
            name:'cancel',
            shortText:'Cancel',
        }
        {
            name:'ok'
            shortText:'Ok',
            onClick:(ev,values)=>{
                alert("testvalue="+values.testvalue);
            }
        },
    ]
})
```


           




