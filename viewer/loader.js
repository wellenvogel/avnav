/*
 # vim: ts=2 sw=2 et
 ###############################################################################
 # Copyright (c) 2014, Andreas Vogel andreas@wellenvogel.net
 # parts of software from movable-type
 # http://www.movable-type.co.uk/
 # for their license see the file latlon.js
 #
 #  Permission is hereby granted, free of charge, to any person obtaining a
 #  copy of this software and associated documentation files (the "Software"),
 #  to deal in the Software without restriction, including without limitation
 #  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 #  and/or sell copies of the Software, and to permit persons to whom the
 #  Software is furnished to do so, subject to the following conditions:
 #
 #  The above copyright notice and this permission notice shall be included
 #  in all copies or substantial portions of the Software.
 #
 #  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 #  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 #  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 ###############################################################################

 Load all the necessary js files
 code is taken from the ol3 examples
 */

(function() {

    var i, pair;

    var href = window.location.href, start, end, paramsString, pairs,
        pageParams = {};
    if (href.indexOf('?') > 0) {
        start = href.indexOf('?') + 1;
        end = href.indexOf('#') > 0 ? href.indexOf('#') : href.length;
        paramsString = href.substring(start, end);
        pairs = paramsString.split(/[&;]/);
        for (i = 0; i < pairs.length; ++i) {
            pair = pairs[i].split('=');
            if (pair[0]) {
                pageParams[decodeURIComponent(pair[0])] =
                    decodeURIComponent(pair[1]);
            }
        }
    }

    var scripts = [
        '../libraries/jquery/jquery-1.11.0.min.js',
        '../libraries/jquery/jquery.cookie.js',
        '../libraries/movable-type/geo.js',
        '../libraries/movable-type/latlon.js',
        '../libraries/less/less-1.4.1.min.js',
        '../libraries/rangeslider/rangeslider.css',
        '../libraries/rangeslider/rangeslider.js'
    ];
    //scripts used in debug mode
    var debug_scripts = [
        '../libraries/ol3b4/ol-whitespace.js',
        '../libraries/closure-library/closure/goog/base.js',
        '../libraries/closure-library/closure/goog/deps.js',
        'deps.js',
        'avnav_viewer.js'];
    //scripts in runmode
    var run_scripts = [
        '../libraries/ol3b4/ol.js', //TODO: replace by minified version
        'avnav_min.js'
    ];
    var mode="";
    if ('mode' in pageParams) {
        mode = pageParams.mode.toLowerCase();
    }
    if (mode == "debug"){
        scripts=scripts.concat(debug_scripts);
    }
    else {
        scripts=scripts.concat(run_scripts);
    }
    for (i in scripts) {
        var scriptname = scripts[i];
        if (scriptname.match(/\.css/)){
            document.write('<link rel="stylesheet" type="text/css" href="'+scriptname+'"/>');
        }
        else {
            document.write('<scr' + 'ipt type="text/javascript" src="' + scriptname + '"></scr' + 'ipt>');
        }
    }
}());
