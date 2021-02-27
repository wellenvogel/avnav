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
 * reduce the number of points in a track/route
 * taken/inspired by BABEL https://github.com/gpsbabel/gpsbabel/blob/master/smplrout.cc
 */
import NavCompute from "./navcompute";
class SimpleRouteFilter {
    /**
     * create a filter to reduce the number of points
     * @param points {Array} array of waypoints (lon,lat)
     * @param useLen if set to true use the len diff instead of the xte
     * @param opt_count if set to a value - stop if we reached this count
     * @param opt_maxXte if set stop if the minimal xte for a point is larger
     *        one of opt_count or opt_maxXte must be set
     */
    constructor(points, useLen, opt_count, opt_maxXte) {
        this.points = points;
        this.useLen = useLen;
        this.count = opt_count;
        this.maxXte = opt_maxXte;
        this.computePoints = [];
        this.minIndex = undefined;
        this.removedMax = undefined;
        if (this.count === undefined && this.maxXte === undefined) throw new Error("either maxXte or count must be given");
    }

    /**
     * compute the xte for a tuple of 3 points
     * @private
     * @param start
     * @param dest
     * @param current
     * @returns {number}
     */
    computeXte(start, dest, current) {
        if (this.useLen){
            let dist=NavCompute.computeDistance(start,current).dts+
                NavCompute.computeDistance(current,dest).dts-
                NavCompute.computeDistance(start,dest).dts;
            return Math.abs(dist);
        }
        else{
            return Math.abs(NavCompute.computeXte(start,dest,current));
        }
    }

    /**
     * compute the point with the minimal xte
     * @private
     */
    computeMin() {
        this.minIndex = undefined;
        let currentMin = undefined;
        for (let i = 0; i < this.computePoints.length; i++) {
            let point = this.computePoints[i];
            if (point.xte === undefined) continue;
            let xte = point.xte;
            if (currentMin === undefined || xte < currentMin) {
                currentMin = xte;
                this.minIndex = i;
            }
        }
    }

    /**
     * compute the xte for all points
     * this resets the internal computation
     */
    computeAlLXte() {
        if (this.points.length < 3) return;
        for (let i = 0; i < this.points.length; i++) {
            let xte = undefined;
            if (i > 0 && i < (this.points.length - 1)) xte = this.computeXte(this.points[i - 1], this.points[i + 1], this.points[i]);
            this.computePoints.push({
                point: this.points[i],
                xte: xte
            })
        }
        this.computeMin();
    }

    /**
     * the main processing function
     * returns the reduced list of points
     * @returns {[]|*}
     */
    process() {
        if (this.points.length < 3) return this.points;
        if (this.count >= this.points.length) return this.points;
        this.computeAlLXte();
        while (1) {
            if (this.maxXte !== undefined) {
                if (this.computePoints[this.minIndex].xte > this.maxXte) break;
            }
            if (this.count !== undefined) {
                if (this.computePoints.length <= this.count) break;
            }
            let removed = this.removePoint();
            if (!removed) break;
        }
        let rt = [];
        this.computePoints.forEach((point) => {
            rt.push(point.point);
        })
        return rt;
    }

    /**
     * removes the point with the minimal xte
     * @private
     * @returns {boolean}
     */
    removePoint() {
        let pointIndex = this.minIndex;
        let point = this.computePoints[pointIndex];
        if (!point) return false;
        this.removedMax = point.xte;
        this.computePoints.splice(pointIndex, 1);
        //now compute neighbours
        if (pointIndex < (this.computePoints.length - 1) && pointIndex > 0) {
            let xte = this.computeXte(this.computePoints[pointIndex - 1].point,
                this.computePoints[pointIndex + 1].point,
                this.computePoints[pointIndex].point);
            if (xte !== this.computePoints[pointIndex].xte) {
                this.computePoints[pointIndex].xte = xte;
            }
        }
        if (pointIndex < this.computePoints.length && pointIndex > 1) {
            let xte = this.computeXte(this.computePoints[pointIndex - 2].point,
                this.computePoints[pointIndex].point,
                this.computePoints[pointIndex - 1].point);
            if (xte !== this.computePoints[pointIndex - 1].xte) {
                this.computePoints[pointIndex - 1].xte = xte;
            }
        }
        this.computeMin();
        return true;
    }
}

export default SimpleRouteFilter;