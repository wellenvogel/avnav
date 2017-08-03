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


 */

window.avnav={};
(function () {
    require('./version.js');
    require('./base.js');
    avnav.ensurePath('avnav.util');
    avnav.util.Formatter=require('./util/formatter.js');
    require('./util/propertyhandler.js');
    require('./util/helper.js');
    avnav.util.Overlay=require('./util/overlay.js');
    require('./map/drawing.js');
    require('./map/mapholder.js');
    require('./map/navlayer.js');
    require('./map/aislayer.js');
    require('./map/tracklayer.js');
    require('./map/routelayer.js');
    avnav.ensurePath('avnav.gui');
    require('./gui/handler.js');
    avnav.gui.Page=require('./gui/page.jsx');
    require('./gui/mainpage.jsx');
    require('./gui/navpage.jsx');
    require('./gui/aispage.jsx');
    require('./gui/aisinfopage.jsx');
    require('./gui/settingspage.jsx');
    require('./gui/statuspage.jsx');
    require('./gui/addresspage.jsx');
    require('./gui/infopage.jsx');
    require('./gui/gpspage.js');
    require('./gui/routepage.jsx');
    require('./gui/downloadpage.jsx');
    require('./gui/wpapage.jsx');
    require('./avnav_viewer.js');
}());
