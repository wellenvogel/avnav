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
(function(undefined) {
if (!('Date' in this && 'now' in this.Date && 'getTime' in this.Date.prototype)) {

// Date.now
Date.now = function now() {
	return new Date().getTime();
};

}

if (!('performance' in this && 'now' in this.performance)) {

// performance.now
(function (global) {

var
startTime = Date.now();

if (!global.performance) {
    global.performance = {};
}

global.performance.now = function () {
    return Date.now() - startTime;
};

}(this));

}

if (!('requestAnimationFrame' in this)) {

// requestAnimationFrame
(function (global) {
	var rafPrefix;

	if ('mozRequestAnimationFrame' in global) {
		rafPrefix = 'moz';

	} else if ('webkitRequestAnimationFrame' in global) {
		rafPrefix = 'webkit';

	}

	if (rafPrefix) {
		global.requestAnimationFrame = function (callback) {
		    return global[rafPrefix + 'RequestAnimationFrame'](function () {
		        callback(performance.now());
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

				callback(performance.now());
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
