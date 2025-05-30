/**
 *###############################################################################
 # Copyright (c) 2012-2020 Andreas Vogel andreas@wellenvogel.net
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
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 ###############################################################################
 * display the infos of a route
 */

import Formatter from '../util/formatter';
import navdata from "../nav/navdata";

let RouteHandler=navdata.getRoutingHandler();

export const INFO_ROWS=[
    {label:'name',value:'name'},
    {label:'points',value:'numPoints'},
    {label:'length',value:'length',formatter:(v)=>{
        return Formatter.formatDistance(v)+" nm";
        }},
    {label:'next point',value:'nextTarget',formatter:(v)=>v.name}
    ];
export const getRouteInfo = (routeName) => {
    return new Promise((resolve, reject) => {
        if (!routeName) reject("missing route name");
        RouteHandler.fetchRoute(routeName,false,(route)=>{
                let info=RouteHandler.getInfoFromRoute(route);
                let rt={
                    length: info.length,
                    numPoints: info.numpoints,
                }
                resolve(rt);
            }
            ,(error) => reject(error)
        );
    })
}