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

/**
 * the base for our namespace
 * @type {{}}
 */
if (! avnav) {
    var avnav = {};


    /**
     * inherit (or better: proto delegation)
     * @param child
     * @param parent
     */
    avnav.inherits = function (child, parent) {
        if (parent === undefined) {
            throw ("parent is undefined for inherit to "+child);
        }
        child.prototype = Object.create(parent.prototype);
        child.prototype.super_ = parent.prototype;
        child.prototype.base_ = parent;
    };
    /**
     *
     * @param {string} name
     */
    avnav.provide = function (name) {
        var names = name.split('.');
        if (names[0] != 'avnav') throw "first part of namespace must be avnav";
        var i;
        var current = avnav;
        var path = names[0];
        for (i = 1; i < names.length - 1; i++) {
            var cname = names[i];
            if (!current[cname]) {
                current[cname] = {};
            }
            else {
                if (!current[cname] instanceof  Object) throw path + "." + cname + " exists but is no object";
            }
            current = current[cname];
            path = path + "." + cname;
        }
        if (current[names[names.length - 1]]) throw "name " + name + " already defined";
    };

    /**
     * one level clone
     * @param obj
     * @returns {{}}
     */
    avnav.clone=function(obj){
            var res = {};
            for (var key in obj) {
                res[key] = obj[key];
            }
            return res;
    };

    avnav.assign=function(target,obj){
        if (! target) target={};
        for (var key in obj) {
            target[key] = obj[key];
        }
        return target;
    }
}
