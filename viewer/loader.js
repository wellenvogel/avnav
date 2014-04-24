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

var scripts=[
    '../libraries/ol3b4/ol-whitespace.js',
    '../libraries/jquery/jquery-1.11.0.min.js',
    '../libraries/jquery/jquery.cookie.js',
    '../libraries/movable-type/geo.js',
    '../libraries/movable-type/latlon.js',
    '../libraries/less/less-1.4.1.min.js',
    'avnav_viewer.js'
];

for (var i in scripts){
    var scriptname=scripts[i];
    document.write('<scr' + 'ipt type="text/javascript" src="'+scriptname+'"></scr' + 'ipt>');
}
