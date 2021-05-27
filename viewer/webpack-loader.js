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

(function () {
    var SUFFIX=1; //will be changed by copy-webpack-plugin
    var scripts = [
        'libraries/geo.js',
        'libraries/latlon.js',
        'avnav_min.js',
        'avnav_viewer.css',
        '/user/viewer/user.css',
        'polyfill.js'
    ];
    if (window.location.search.match(/[?&]androidshim=true/)){
        scripts.splice(0,0,'test/androidshim.js');
    }
    for (var i in scripts) {
        var scriptname = scripts[i];
        if (scriptname.match(/\.css/)){
            document.write('<link rel="stylesheet" type="text/css" href="'+scriptname+'?_='+SUFFIX+'"/>');
        }
        else {
            document.write('<scr' + 'ipt type="text/javascript" src="' + scriptname + '?_='+SUFFIX+'"></scr' + 'ipt>');
        }
    }
}());
