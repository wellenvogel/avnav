/* Polyfill service v3.15.0
 * For detailed credits and licence information see https://github.com/financial-times/polyfill-service.
 * 
 * UA detected: other/0.0.0 (unknown/unsupported; using policy `unknown=polyfill`)
 * Features requested: requestAnimationFrame
 * 
 * - Date.now, License: CC0 (required by "requestAnimationFrame", "performance.now")
 * - performance.now, License: CC0 (required by "requestAnimationFrame")
 * - requestAnimationFrame, License: MIT */
//https://cdn.polyfill.io/v2/polyfill.js?features=requestAnimationFrame&ua=dummy&unknown=polyfill&flags=gated
//and modified to avoid performance.now that is reset somehow...
(function(undefined) {

	if (! window.SVGElement){
		//old safari on Playbook - measure will not work without this
		window.SVGElement=function(){};
	}
if (!('Date' in this && 'now' in this.Date && 'getTime' in this.Date.prototype)) {

// Date.now
Date.now = function now() {
	return new Date().getTime();
};

}



if (!('requestAnimationFrame' in this)) {

// requestAnimationFrame
(function (global) {
	var rafPrefix;
	var emulatePerformanceNow;
	if (!('performance' in this && 'now' in this.performance)) {
		emulatePerformanceNow=Date.now();
	}

	if ('mozRequestAnimationFrame' in global) {
		rafPrefix = 'moz';

	} else if ('webkitRequestAnimationFrame' in global) {
		rafPrefix = 'webkit';

	}

	if (rafPrefix) {
		global.requestAnimationFrame = function (callback) {
		    return global[rafPrefix + 'RequestAnimationFrame'](function () {
		        callback(emulatePerformanceNow?(Date.now()-emulatePerformanceNow):performance.now());
		    });
		};
		global.cancelAnimationFrame = global[rafPrefix + 'CancelAnimationFrame'];
	} else {

		var lastTime = Date.now();

		global.requestAnimationFrame = function (callback) {
			if (typeof callback !== 'function') {
				throw new TypeError(callback + ' is not a function');
			}

			var
			currentTime = Date.now(),
			delay = 16 + lastTime - currentTime;

			if (delay < 0) {
				delay = 0;
			}

			lastTime = currentTime;

			return setTimeout(function () {
				lastTime = Date.now();

				callback(emulatePerformanceNow?(Date.now()-emulatePerformanceNow):performance.now());
			}, delay);
		};

		global.cancelAnimationFrame = function (id) {
			clearTimeout(id);
		};
	}
}(this));

}

})
.call('object' === typeof window && window || 'object' === typeof self && self || 'object' === typeof global && global || {});
