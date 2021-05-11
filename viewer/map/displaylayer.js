

/**
* Created by kds on 10.2.2021 modified 06.05.2021
*/


import NavCompute from '../nav/navcompute';
import navobjects from '../nav/navobjects';
import keys from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';
import assign from 'object-assign';

const StyleEntry = function(src, style) {
	this.style = assign({}, style);
	this.src = src;
	if (src !== undefined) {
		this.image = new Image();
		this.image.src = src;
	}
};

/**
* a cover for the layer that contaisn the booat, the current wp and the route between them
* @param {MapHolder} mapholder
* @constructor
*/
const DisplayLayer = function(mapholder) {
	/**
	* @private
	* @type {MapHolder}
	*/
	this.mapholder = mapholder;
	this.deltat = 0
	this.oldtime = 0


	/**
	* the initial course must be different from 0 to create a style...
	* @private
	* @type {olStyle}
	*/
	this.displayStyle = {
		anchor: [200, 200],
		size: [400, 400],
		src: {},
		rotation: 0,
		rotateWithView: true,
		SymbolAlpha: 0.7,
		image: {}
	};
	//  this.boatStyle.image.src=this.boatStyle.src;

	this.positionKeys = {
		course: keys.nav.gps.course,
		speed: keys.nav.gps.speed,	// m/s
		position: keys.nav.gps.position,
		valid: keys.nav.gps.valid,
		windangle: keys.nav.gps.windAngle,
		windSpeed: keys.nav.gps.windSpeed,
		windAngleAverage: keys.nav.gps.windAngleAverageOn,
		windSpeedAverage: keys.nav.gps.windSpeedAverageOn,
		windReference: keys.nav.gps.windReference,
		waypoint: keys.nav.wp,	//.vmg in m/s
		gps: keys.nav.gps,
		TSS: keys.nav.gps.TSS,
		TWA: keys.nav.gps.TWA,		
		TWD: keys.nav.gps.TWD,		
		AWD: keys.nav.gps.AWD,		
		TWS: keys.nav.gps.TWS,		
		TWS: keys.nav.gps.TWS,
		LLBB:keys.nav.gps.LLBB,
		LLSB:keys.nav.gps.LLSB,

	};

this.TWD_Abweichung= [0, 0]	// in deg
this.Polare=null
this.Position= 0	//nav.gps.position,



	/**
	 * compute the icons for the Sailsteer display
	 * @private
	 */

	DisplayLayer.prototype.createInternalIcons = function() {
		this.symbolStyles.KompassRing = new StyleEntry(this.CreateKompassringIcon(), this.displayStyle);
		this.symbolStyles.OuterRing = new StyleEntry(this.CreateOuterRingIcon(), this.displayStyle);
		this.symbolStyles.WindA = new StyleEntry(this.createWindpfeilIcon("rgb(0,255,0)", 'A'), this.displayStyle);
		this.symbolStyles.WindT = new StyleEntry(this.createWindpfeilIcon("blue", 'T'), this.displayStyle);
		this.symbolStyles.WindA = new StyleEntry(this.createWindpfeilIcon("rgb(0,255,0)", 'A'), this.displayStyle);
		this.symbolStyles.WindM = new StyleEntry(this.createWindpfeilIcon("yellow", '~'), this.displayStyle);
		this.symbolStyles.LaylineBB = new StyleEntry(this.createLaylineIcon("red", this.TWD_Abweichung), this.displayStyle);
		this.symbolStyles.LaylineSB = new StyleEntry(this.createLaylineIcon("rgb(0,255,0)", this.TWD_Abweichung), this.displayStyle);
		//  this.symbolStyles.LaylineBB_Area = new StyleEntry(this.createLaylineArea("red", this.TWD_Abweichung),this.displayStyle);
		//  this.symbolStyles.LaylineSB_Area = new StyleEntry(this.createLaylineArea("rgb(0,255,0)", this.TWD_Abweichung),this.displayStyle);
	};


    this.visible=globalStore.getData(keys.properties.layers.instrument);
	this.symbolStyles = {};
	//this.calc_LaylineAreas(60);//globalStore.getData(keys.properties.sailsteerrefresh)*60);
	this.createInternalIcons();
	//this.loadBoatData();


	/**
	* set the style(s)
	* @private
	*/
	DisplayLayer.prototype.setStyle = function() {
	};

	//we do not explicitely register for those keys as we rely on the mapholder
	//triggering a render whenever something changes

	globalStore.register(this, keys.gui.global.propertySequence);

}


DisplayLayer.prototype.drawTargetSymbol = function(drawing, xy, rotation) {
	//    let scale=globalStore.getData(keys.properties.aisIconScale,1);
	//KDS		let rotation=current.course||0;

	for (var symbol in this.symbolStyles) {
		let style = assign({}, this.symbolStyles[symbol].style);
		let scale = 1.0//KDSglobalStore.getData(keys.properties.aisIconScale,1);

		style.size = [style.size[0] * scale, style.size[1] * scale];
		style.anchor = [style.anchor[0] * scale, style.anchor[1] * scale];
		if (style.rotation !== undefined && !style.rotateWithView) {
			style.rotateWithView = false;
			rotation = 0
			style.rotation *= Math.PI / 180;
		}
		else {
			style.rotation += rotation
			style.rotation *= Math.PI / 180;
		}

		drawing.drawImageToContext(xy, this.symbolStyles[symbol].image, style);
		//		NOW THE DYNAMIC CONTENT TO BE DIRECTLY DRAWN ONTO CANVAS;
		if (symbol == "LaylineBB" || symbol == "LaylineSB") {
			this.calc_LaylineAreas()
			drawing.context.save()
			this.DrawLaylineArea(drawing, xy, symbol == "LaylineBB" ? "red" : "green", style)
			drawing.context.restore()

			//TODO
			// Berechnung aus der for Schleife nehmen
			let dist_SB = globalStore.getData(keys.properties.sailsteerlength)
			let dist_BB = dist_SB
			if (this.gps.waypoint.position) {
				let is_BB = LatLon.intersection(new LatLon(this.gps.position.lat, this.gps.position.lon), this.gps.LLSB, new LatLon(this.gps.waypoint.position.lat, this.gps.waypoint.position.lon), this.gps.LLBB + 180)
				let is_SB = LatLon.intersection(new LatLon(this.gps.position.lat, this.gps.position.lon), this.gps.LLBB, new LatLon(this.gps.waypoint.position.lat, this.gps.waypoint.position.lon), this.gps.LLSB + 180)
				let WP_Point = new navobjects.Point(this.gps.waypoint.position.lon, this.gps.waypoint.position.lat)
				let WP_Map = this.mapholder.pointToMap(WP_Point.toCoord());
				let BP_Point = this.mapholder.pointFromMap(xy)
				let BP_Map = xy;

				// Wende/Halse-Punkte berechnen
				if (is_SB != null && is_BB != null) {
					let pos_SB = this.mapholder.pointToMap((new navobjects.Point(is_SB._lon, is_SB._lat)).toCoord());
					let pos_BB = this.mapholder.pointToMap((new navobjects.Point(is_BB._lon, is_BB._lat)).toCoord());
					dist_SB = NavCompute.computeDistance(new navobjects.Point(is_SB._lon, is_SB._lat), WP_Point).dts
					dist_BB = NavCompute.computeDistance(new navobjects.Point(is_BB._lon, is_BB._lat), WP_Point).dts
				}

				//Laylines vom Wegpunkt zeichnen
				let draw_distance = globalStore.getData(keys.properties.sailsteeroverlap) ? globalStore.getData(keys.properties.sailsteerlength):Math.min(symbol == "LaylineBB" ? dist_BB : dist_SB,globalStore.getData(keys.properties.sailsteerlength))
				let targetWP = this.computeTarget(WP_Map, style.rotation * 180 / Math.PI + 180, draw_distance)
				if (globalStore.getData(keys.properties.sailsteermarke))
					drawing.drawLineToContext([WP_Map, targetWP], { color: symbol == "LaylineBB" ? "red" : "green", width: 5, dashed: false });
				// Only for testing purposes
				//if (is_SB != null && is_BB != null)
				//drawing.drawLineToContext([pos_SB, pos_BB], { color: "blue", width: 5 });
			}

			//Laylines vom Boot zeichnen
			let test=globalStore.getData(keys.properties.sailsteeroverlap)
			let draw_distance = globalStore.getData(keys.properties.sailsteeroverlap) ? globalStore.getData(keys.properties.sailsteerlength):Math.min(symbol == "LaylineBB" ? dist_BB : dist_SB,globalStore.getData(keys.properties.sailsteerlength))
			let targetboat = this.computeTarget(xy, style.rotation * 180 / Math.PI, draw_distance)
			if (globalStore.getData(keys.properties.sailsteerboot))
				drawing.drawLineToContext([xy, targetboat], { color: symbol == "LaylineBB" ? "red" : "green", width: 5, dashed: false });
			drawing.drawImageToContext(xy, this.symbolStyles[symbol].image, style);
		}

	}
}



/**
* draw the marker and course
* we rely on the move end to really store the marker position
* @param {olCoordinate} center in map coordinates
* @param {Drawing} drawing
*/

DisplayLayer.prototype.onPostCompose = function(center, drawing, devpixelRatio) {
    if (! this.visible) return;
	this.gps = globalStore.getMultiple(this.positionKeys);
	this.devPixelRatio=devpixelRatio
	let course = this.gps.course;
	let rotation = 0
	if (this.gps.valid) {
		this.deltat = performance.now() - this.oldtime
		this.oldtime = performance.now()
		this.loop();
		this.drawTargetSymbol(drawing, center,this.gps.course);
	}
}





/**
* compute a target point in map units from a given point
* for drawing the circles
* assumes "flatted" area around the point
* @param {olCoordinate} pos in map coordinates
* @param {number} course in degrees
* @param {number} dist in m
*/
DisplayLayer.prototype.computeTarget = function(pos, course, dist) {
	let point = new navobjects.Point();
	point.fromCoord(this.mapholder.transformFromMap(pos));
	let tp = NavCompute.computeTarget(point, course, dist);
	let tpmap = this.mapholder.transformToMap(tp.toCoord());
	return tpmap;
};



DisplayLayer.prototype.dataChanged = function() {
	this.setStyle();
};

DisplayLayer.prototype.setImageStyles = function(styles) {
	if (styles.boatImage) {
		let boat = styles.boatImage;
		if (typeof (boat) === 'object') {
			if (boat.src) {
				this.boatStyle.image.src = boat.src;
				this.boatStyle.src = boat.src;
			}
			if (boat.anchor && boat.anchor instanceof Array && boat.anchor.length == 2) this.boatStyle.anchor = boat.anchor;
			if (boat.size && boat.size instanceof Array && boat.size.length == 2) this.boatStyle.size = boat.size;
			if (boat.rotate !== undefined) this.boatStyle.rotate = boat.rotate;
			if (boat.courseVector !== undefined) this.boatStyle.courseVector = boat.courseVector;
			if (boat.courseVectorColor !== undefined) this.boatStyle.courseVectorColor = boat.courseVectorColor;
		}
	}
}


DisplayLayer.prototype.read_nmea_values = function() {
	if (this.gps.valid) {
		this.Position = new LatLon(this.gps.position.lat, this.gps.position.lon)

	}
}


DisplayLayer.prototype.calc_values = function() {
	// https://www.rainerstumpe.de/HTML/wind02.html
	// https://www.segeln-forum.de/board1-rund-ums-segeln/board4-seemannschaft/46849-frage-zu-windberechnung/#post1263721
	//var d = new Date();
	//var now = d.getTime();



//console.log("display "+ "TWD "+TWD.toFixed(1)+ " TWS "+TWS.toFixed(1))
		

	if (this.Polare) {
		// LAYLINES
		if (Math.abs(this.gps.TWA) > 90 && Math.abs(this.gps.TWA) < 270) {
			var wendewinkel =
				this.linear(
					(this.gps.TWS / 0.514),
					this.Polare.windspeedvector,
					this.Polare.wendewinkel.downwind
				) * 2
		} else {
			var wendewinkel =
				this.linear(
					(this.gps.TWS / 0.514),
					this.Polare.windspeedvector,
					this.Polare.wendewinkel.upwind
				) * 2
		}
		this.wendewinkel = wendewinkel;

		this.LL_SB = (this.gps.TWD + this.wendewinkel / 2) % 360
		this.LL_BB = (this.gps.TWD - this.wendewinkel / 2) % 360



		var anglew = this.gps.TWA > 180 ? 360 - this.gps.TWA : this.gps.TWA
		this.SOGPOLvar = this.bilinear(
			this.Polare.windspeedvector,
			this.Polare.windanglevector,
			this.Polare.boatspeed,
			(this.gps.TWS / 0.514),
			anglew
		)
		// for testing puposes replace measured speed by calc. speed from polare
		//		(this.gps.speed * 1.94384) = (this.gps.speed * 1.94384) = this.BoatData.SOGPOLvar

	}
	//      Route: {latlon: 0, active: false, dir:0,dist: 0, name:"",wp_name:"",}
	this.VMGvar = ((this.gps.speed * 1.94384) * Math.cos(this.gps.TWA * Math.PI) / 180)
	if (this.Route.active) {
		mySVG.get('pathWP').style('display', null)
		this.Route.dir = this.Position.bearingTo(this.Route.latlonTo)
		this.Route.dist =
			this.Position.distanceTo(this.Route.latlonTo) * 0.539957
		this.Route.VMCvar =
			(this.gps.speed * 1.94384) *
			Math.cos(((this.Route.dir - this.gps.course) * Math.PI) / 180)
	} else {
		//      mySVG.get('pathWP').style('display', 'none')
		this.Route.VMCvar = NaN
	}
	//	console.log(this.BoatData)
}

DisplayLayer.prototype.xml2json = function(xml) {
	try {
		var obj = {}
		if (xml.children.length > 0) {
			for (var i = 0; i < xml.children.length; i++) {
				var item = xml.children.item(i)
				var nodeName = item.nodeName

				if (typeof obj[nodeName] === 'undefined') {
					obj[nodeName] = this.xml2json(item)
				} else {
					if (typeof obj[nodeName].push === 'undefined') {
						var old = obj[nodeName]

						obj[nodeName] = []
						obj[nodeName].push(old)
					}
					obj[nodeName].push(this.xml2json(item))
				}
			}
		} else {
			obj = xml.textContent
		}
		return obj
	} catch (e) {
		console.log(e.message)
	}
}

/*
DisplayLayer.prototype.loadBoatData = function() {
	var xmlFile = 'polare.xml'
	var loadXML = new XMLHttpRequest()
	//    loadXML.onload = callback
	loadXML.open('GET', xmlFile, false)
	loadXML.send();
	if (loadXML.status === 200) {
		this.Polare = this.xml2json(loadXML.responseXML).Data
	}
}
*/

DisplayLayer.prototype.loop = function() {
	// wird mit aktualisierungsfrequenz aufgerufen

	if (this.gps.valid) {
//		this.Position = new LatLon(this.gps.position.lat, this.gps.position.lon)
		this.Position = LatLon(this.gps.position.lat, this.gps.position.lon)
//		this.calc_values();
		//	var tn = formatNumber(this.gps.course.toString(), '000')
		//	var m = SVG.get('Kurstext')
		//m.text(tn)
		this.symbolStyles.KompassRing.style.rotation = -this.gps.course;
		this.symbolStyles.WindT.style.rotation = this.gps.TWA;
		this.symbolStyles.WindA.style.rotation = this.gps.windangle;
		this.symbolStyles.WindM.style.rotation = this.gps.TSS - this.gps.course;
		//	this.symbolStyles.WindA.style.rotation=this.gps.windangle;
		this.symbolStyles.LaylineSB.style.rotation = this.gps.LLSB - this.gps.course;
		this.symbolStyles.LaylineBB.style.rotation = this.gps.LLBB - this.gps.course;
		/*
		if (this.Route.active) {
			SVG.get('pathWP').rotate(
				this.BoatData.Route.dir - this.gps.course,
				SVG.get('circle-LL').cx(),
				SVG.get('circle-LL').cy()
		}
		*/
	}
}

DisplayLayer.prototype.checkfunc = function(currentValue, index) {
	return currentValue > this
}

DisplayLayer.prototype.linear = function(x, xv, yv) {
	var x_vector = JSON.parse(xv)
	var y_vector = JSON.parse(yv)
	var x2i = x_vector.findIndex(this.checkfunc, x)

	// y_vector = BoatData.Polare.wendewinkel.upwind;
	x2i = x2i < 1 ? 1 : x2i
	var x2 = x_vector[x2i]
	var y2 = y_vector[x2i]
	var x1i = x2i - 1
	var x1 = x_vector[x1i]
	var y1 = y_vector[x1i]
	var y = ((x2 - x) / (x2 - x1)) * y1 + ((x - x1) / (x2 - x1)) * y2
	return y
}

DisplayLayer.prototype.bilinear = function(xv, yv, zv, x, y) {
	var ws = JSON.parse(xv)
	var angle = JSON.parse(yv)
	var speed = JSON.parse(zv)

	var x2i = ws.findIndex(this.checkfunc, x)
	x2i = x2i < 1 ? 1 : x2i
	var x2 = ws[x2i]
	var x1i = x2i - 1
	var x1 = ws[x1i]

	var y2i = angle.findIndex(this.checkfunc, y)
	y2i = y2i < 1 ? 1 : y2i
	var y2 = angle[y2i]
	var y1i = y2i - 1
	var y1 = angle[y2i - 1]

	var ret =
			/* f(x,y)= */ ((y2 - y) / (y2 - y1)) *
		(((x2 - x) / (x2 - x1)) * speed[y1i][x1i] /* f(x1,y1) */ +
			((x - x1) / (x2 - x1)) * speed[y1i][x2i]) /* f(x1,y2) */ +
		((y - y1) / (y2 - y1)) *
		(((x2 - x) / (x2 - x1)) * speed[y2i][x1i] /* f(x1,y2) */ +
			((x - x1) / (x2 - x1)) * speed[y2i][x2i]) /* f(x2,y2) */
	return ret
}



DisplayLayer.prototype.CreateOuterRingIcon = function() {
	let canvas = document.createElement("canvas");
	if (!canvas) return undefined;
	canvas.width = 400;
	canvas.height = 400;
	let ctx = canvas.getContext('2d');

	var x = canvas.width / 2;
	var y = canvas.height / 2;
	var radius = 130;
	ctx.restore();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	var someColors = [];
	someColors.push("#F00");
	someColors.push("#000");
	someColors.push("#0F0");

	drawMultiRadiantCircle(x, y, radius, someColors);

	function drawMultiRadiantCircle(xc, yc, r, radientColors) {
		var partLength = (2 * Math.PI) / 2;
		var start = -Math.PI / 2;
		var gradient = null;
		var startColor = null,
			endColor = null;

		for (var i = 0; i < 2; i++) {
			startColor = radientColors[i];
			endColor = radientColors[(i + 1) % radientColors.length];

			// x start / end of the next arc to draw
			var xStart = xc + Math.cos(start) * r;
			var xEnd = xc + Math.cos(start + partLength) * r;
			// y start / end of the next arc to draw
			var yStart = yc + Math.sin(start) * r;
			var yEnd = yc + Math.sin(start + partLength) * r;

			ctx.beginPath();

			gradient = ctx.createLinearGradient(xStart, yStart, xEnd, yEnd);
			gradient.addColorStop(0, startColor);
			gradient.addColorStop(1.0, endColor);

			ctx.strokeStyle = gradient;
			ctx.arc(xc, yc, r, start, start + partLength);
			ctx.lineWidth = 20;
			ctx.stroke();
			ctx.closePath();

			start += partLength;
		}
	}
	ctx.restore();
	ctx.translate(x, y); // Nullpunkt auf den Mittelpunkt des Canvas setzen
	ctx.save();
	for (var i = 0; i < 360; i += 10) {
		//ctx.restore();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.translate(x, y); // Nullpunkt auf den Mittelpunkt des Canvas setzen
		ctx.rotate((i / 180) * Math.PI);
		if (i % 30 == 0) {
			ctx.beginPath(); // Start a new path
			ctx.moveTo(0, -122); // Move the pen to (30, 50)
			ctx.lineTo(0, -138); // Draw a line to (150, 100)
			ctx.lineWidth = 2;
			ctx.strokeStyle = "rgb(255,255,255)";
			ctx.stroke(); // Render the path				ctx.fillStyle='rgb(255,255,255)';
		} else {
			ctx.beginPath();
			ctx.fillStyle = "rgb(190,190,190)";
			ctx.arc(0, -130, 2, 0, 2 * Math.PI, false);
			ctx.fill();
			ctx.lineWidth = 1;
			ctx.strokeStyle = "rgb(190,190,190)";
			ctx.stroke();
		}
	}
	ctx.restore();
	return canvas.toDataURL();
}; //Ende OuterRing

DisplayLayer.prototype.CreateKompassringIcon = function() {
	let canvas = document.createElement("canvas");
	if (!canvas) return undefined;
	canvas.width = 400;
	canvas.height = 400;

	let ctx = canvas.getContext('2d');
	var x = canvas.width / 2;
	var y = canvas.height / 2;
	var radius = 105;
	ctx.restore();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
	ctx.lineWidth = 20;
	ctx.strokeStyle = "rgb(255,255,255)";
	ctx.stroke();
	ctx.translate(x, y); // Nullpunkt auf den Mittelpunkt des Canvas setzen
	ctx.save();
	for (var i = 0; i < 360; i += 10) {
		//ctx.restore();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.translate(x, y); // Nullpunkt auf den Mittelpunkt des Canvas setzen
		ctx.rotate((i / 180) * Math.PI);
		if (i % 30 == 0) {
			ctx.fillStyle = "rgb(00,00,00)";
			ctx.textAlign = "center";
			ctx.font = "bold 12px Arial";
			ctx.fillText(i.toString().padStart(3, "0"), 0, -radius + 5);
		} else {
			ctx.beginPath();
			ctx.fillStyle = "rgb(100,100,100)";
			ctx.arc(0, -radius, 2, 0, 2 * Math.PI, false);
			ctx.fill();
			ctx.lineWidth = 1;
			ctx.strokeStyle = "rgb(100,100,100)";
			ctx.stroke();
		}
	}
	ctx.restore();
	return canvas.toDataURL();
}; // Ende Kompassring


DisplayLayer.prototype.createWindpfeilIcon = function(color, Text) {
	let canvas = document.createElement("canvas");
	if (!canvas) return undefined;
	canvas.width = 400;
	canvas.height = 400;
	let ctx = canvas.getContext('2d');

	var x = canvas.width / 2;
	var y = canvas.height / 2;
	var radius_kompassring = 105;
	var radius_outer_ring = 130;
	ctx.restore();
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.translate(x, y); // Nullpunkt auf den Mittelpunkt des Canvas setzen

	ctx.beginPath();
	if (Text == 'A')
		ctx.moveTo(0, -radius_kompassring + 15); // Move pen to bottom-center corner
	else
		ctx.moveTo(0, -radius_kompassring - 10); // Move pen to bottom-center corner
	ctx.lineTo(-15, -150); // Line to top left corner
	ctx.lineTo(+15, -150); // Line to top-right corner
	ctx.closePath(); // Line to bottom-center corner
	ctx.fillStyle = color;
	ctx.lineWidth = 1;
	ctx.strokeStyle = color;
	ctx.fill();
	ctx.strokeStyle = "rgb(0,0,0)";
	ctx.stroke(); // Render the path				ctx.fillStyle='rgb(255,255,255)';

	ctx.fillStyle = "rgb(255,255,255)";
	ctx.textAlign = "center";
	ctx.font = "bold 20px Arial";
	ctx.fillText(Text, 0, -130);
	return canvas.toDataURL();
};





DisplayLayer.prototype.createLaylineIcon = function(color, MinMax) {
	let canvas = document.createElement("canvas");
	if (!canvas) return undefined;
	canvas.width = 400;
	canvas.height = 400;
	let ctx = canvas.getContext('2d');

	var x = canvas.width / 2;
	var y = canvas.height / 2;
	var radius = 100;
	ctx.restore();
	ctx.setTransform(1, 0, 0, 1, 0, 0);

	ctx.translate(x, y); // Nullpunkt auf den Mittelpunkt des Canvas setzen
	ctx.beginPath();
	ctx.moveTo(0, 0); // Move pen to bottom-center corner
	ctx.lineTo(0, -90); // Line to top left corner
	ctx.lineWidth = 4;
	ctx.strokeStyle = color;
	ctx.setLineDash([8, 8]);
	ctx.lineDashOffset = 0;
	ctx.stroke(); // Render the path				ctx.fillStyle='rgb(255,255,255)';
	ctx.restore();
	return canvas.toDataURL();
};


DisplayLayer.prototype.createLaylineArea = function(color, MinMax) {
	let canvas = document.createElement("canvas");
	if (!canvas) return undefined;
	canvas.width = 400;
	canvas.height = 400;
	let ctx = canvas.getContext('2d');

	var x = canvas.width / 2;
	var y = canvas.height / 2;
	var radius = 100;
	// Sektoren
	ctx.restore();
	ctx.setTransform(1, 0, 0, 1, 0, 0);

	ctx.translate(x, y); // Nullpunkt auf den Mittelpunkt des Canvas setzen
	ctx.beginPath();
	ctx.lineWidth = 1;
	ctx.strokeStyle = color;
	ctx.moveTo(0, 0);   // Move pen to bottom-center corner
	ctx.arc(0, 0, radius, Math.PI * (MinMax[0] - 90) / 180, Math.PI * (MinMax[1] - 90) / 180)
	ctx.closePath();
	ctx.save();
	ctx.globalAlpha *= 0.5;
	ctx.fillStyle = color;
	ctx.fill()
	ctx.restore()
	return canvas.toDataURL();

};



DisplayLayer.prototype.DrawKompassring = function(ctx) {

	if (!ctx.canvas) return undefined;
	ctx.save()

	var x = ctx.canvas.width / 2;
	var y = ctx.canvas.height / 2;
	var radius = 105;

	ctx.beginPath();
	ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
	ctx.lineWidth = 20;
	ctx.strokeStyle = "rgb(255,255,255)";
	ctx.stroke();

	ctx.translate(x, y); // Nullpunkt auf den Mittelpunkt des Canvas setzen
	for (var i = 0; i < 360; i += 10) {
		//ctx.restore();
		ctx.translate(x, y); // Nullpunkt auf den Mittelpunkt des Canvas setzen
		ctx.rotate((i / 180) * Math.PI);
		if (i % 30 == 0) {
			ctx.fillStyle = "rgb(00,00,0)";
			ctx.textAlign = "center";
			ctx.font = "bold 12px Arial";
			ctx.fillText(i.toString().padStart(3, "0"), 0, -radius + 3);
		} else {
			ctx.beginPath();
			ctx.fillStyle = "rgb(100,100,100)";
			ctx.arc(0, -radius, 2, 0, 2 * Math.PI, false);
			ctx.fill();
			ctx.lineWidth = 1;
			ctx.strokeStyle = "rgb(100,100,100)";
			ctx.stroke();
		}
	}
	ctx.restore();
}; // Ende Kompassring

DisplayLayer.prototype.DrawLaylineArea = function(drawing, xy, color, opt_options) {
    if (opt_options && opt_options.fixX !== undefined) {
        xy[0]=opt_options.fixX*this.devPixelRatio;
    }
    if (opt_options &&  opt_options.fixY !== undefined) {
        xy[1]=opt_options.fixY*this.devPixelRatio;
    }
	let ctx=drawing.context
    ctx.save();
    //ctx.translate(xy[0],xy[1]);
    let angle=0;
    if (opt_options && opt_options.rotation) {
        angle = opt_options.rotation;
    }
    if (opt_options.rotateWithView) angle+=drawing.rotation;
    //if (angle) ctx.rotate(angle);


	var x = ctx.canvas.width / 2;
	var y = ctx.canvas.height / 2;
	var radius = 90*this.devPixelRatio;
	// Sektoren
	ctx.translate(x, y); // Nullpunkt auf den Mittelpunkt des Canvas setzen
	ctx.rotate(angle)
	ctx.beginPath();
	ctx.lineWidth = 1;
	ctx.strokeStyle = color;
	ctx.moveTo(0, 0);   // Move pen to bottom-center corner
	ctx.arc(0, 0, radius, Math.PI * (this.TWD_Abweichung[0] - 90) / 180, Math.PI * (this.TWD_Abweichung[1] - 90) / 180)
	//		ctx.arc(0, 0,radius, Math.PI*(-45)/180, Math.PI*(45)/180)
	ctx.closePath();
	ctx.globalAlpha *= 0.3;
	ctx.fillStyle = color;
	ctx.fill()


/*
	ctx.rotate(-angle)
	ctx.globalAlpha = 1;
	ctx.fillStyle = "rgb(00,00,0)";
	ctx.textAlign = "center";
	ctx.font = "bold 12px Arial";
	ctx.fillText(this.TWD_Abweichung[0].toFixed(2).toString(), 200, -100);
	ctx.fillText(this.TWD_Abweichung[1].toFixed(2).toString(), 200, -90);
	ctx.fillStyle = "rgb(00,00,0)";
*/	
	ctx.restore()
};




//https://www.geeksforgeeks.org/how-to-get-negative-result-using-modulo-operator-in-javascript/
// mod() function 
Number.prototype.mod = function(a) {

	// Calculate 
	return this % a;
}



DisplayLayer.prototype.calc_LaylineAreas = function() {
	
	let reduktionszeit = globalStore.getData(keys.properties.sailsteerrefresh) * 60
	let difftime = globalStore.getData(keys.properties.positionQueryTimeout) / 1000;

	// Mittelwert TWD berechnen mit Grenzfrequenz 0.01Hz
	// in kartesische Koordinaten umrechnen

	let reduktionsfaktor = 1.
	if (reduktionszeit)
		reduktionsfaktor = 1 - difftime / reduktionszeit;

	// MinMax Abweichungen über der Zeit reduzieren
	for (var i = 0; i < 2; i++)
		this.TWD_Abweichung[i] *= reduktionsfaktor;

	let winkelabweichung = 0;
	winkelabweichung = this.gps.TWD - this.gps.TSS
	winkelabweichung = winkelabweichung.mod(360)
	if (Math.abs(winkelabweichung) > 180)
		var tst = 1
	winkelabweichung = winkelabweichung < -180 ? winkelabweichung % 180 + 180 : winkelabweichung
	winkelabweichung = winkelabweichung > 180 ? winkelabweichung % 180 - 180 : winkelabweichung

	this.TWD_Abweichung[0] = winkelabweichung < this.TWD_Abweichung[0] ? winkelabweichung : this.TWD_Abweichung[0];
	this.TWD_Abweichung[1] = winkelabweichung > this.TWD_Abweichung[1] ? winkelabweichung : this.TWD_Abweichung[1];
	//console.log("TWD_PT1: " + this.gps.TSS.toFixed(2) + " TWD " + this.TWD.toFixed(2) + " delta ", + winkelabweichung.toFixed(2) + " Abw: " + this.TWD_Abweichung[0].toFixed(2) + ":" + this.TWD_Abweichung[1].toFixed(2) + " DT " + this.deltat.toFixed(0))
}

DisplayLayer.prototype.toPolWinkel = function(x, y) // [grad]
{
	//	=WENN(C97<0;180+E97;E97)
	if (x == 0) {
		if (y > 0)
			return (90)
		else
			return (270)
	}
	//	return(x<0?180+180*Math.atan2(x,y)/Math.PI:180*Math.atan2(x,y)/Math.PI)
	return (180 * Math.atan2(y, x) / Math.PI)
}

DisplayLayer.prototype.ToKartesisch = function(alpha) // [grad]
{
	var K = { x: 0, y: 0 }
	K.x = Math.cos(Math.PI * alpha / 180) * 180 / Math.PI;
	K.y = Math.sin(Math.PI * alpha / 180) * 180 / Math.PI;
	return (K)
}



export default DisplayLayer;


