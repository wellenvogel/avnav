/**
 * ###############################################################################
 * Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a
 *  copy of this software and associated documentation files (the "Software"),
 *  to deal in the Software without restriction, including without limitation
 *  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 *  and/or sell copies of the Software, and to permit persons to whom the
 *  Software is furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included
 *  in all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 *  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 *  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 *  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 *  DEALINGS IN THE SOFTWARE.
 *
 * ###############################################################################
 */

import { LatLon } from "../api/geo";
/**
 * Represents the Closest Point of Approach (CPA) data between two vessels
 */
export enum PASS{
    PASS_DONE=undefined,
    PASS_FRONT=1,
    PASS_PASS=-1,
    PASS_BACK=0
}
export interface Cpa {
  /**
   * Static constants for pass type indicators
   */

  /**
   * The source position at CPA
   */
  src: LatLon;

  /**
   * The destination position at CPA
   */
  dst: LatLon;

  /**
   * The crossing point (if applicable)
   */
  crosspoint?: LatLon;

  /**
   * The current distance in meters
   */
  curdistance?: number;

  /**
   * Distance at CPA in meters
   */
  cpa?: number;

  /**
   * Time to CPA in seconds
   */
  tcpa?: number;

  /**
   * Bearing to CPA point in degrees
   */
  bcpa?: number;

  /**
   * Indicates if vessel passes in front (1), at parallel (-1), at back (0), or undefined (parallel crossed)
   */
  passFront?: PASS.PASS_DONE|PASS.PASS_FRONT|PASS.PASS_PASS|PASS.PASS_BACK
}

/**
 * Represents a course vector (either a line or an arc)
 */
export interface CourseVector {
  /**
   * Type constants
   */
  T_LINE?: number;
  T_ARC?: number;

  /**
   * Type of vector: line (0) or arc (1)
   */
  type?: number;

  /**
   * Starting point of the vector
   */
  start?: LatLon;

  /**
   * Ending point of the vector (for line segments)
   */
  end?: LatLon;

  /**
   * Center point of the arc (for arc vectors)
   */
  center?: LatLon;

  /**
   * Starting angle for arc in degrees
   */
  startAngle?: number;

  /**
   * Arc angle in degrees
   */
  arc?: number;

  /**
   * Radius of the arc in meters
   */
  radius?: number;

  /**
   * Offset direction in degrees (for relative motion vector)
   */
  offsetDir?: number;

  /**
   * Offset distance in meters (for relative motion vector)
   */
  offsetDst?: number;
}

/**
 * Represents an AIS (Automatic Identification System) vessel item
 */
export interface AISItem {
  /**
   * The original received AIS data
   */
  received: Record<string, any>;

  /**
   * Position from received data
   */
  receivedPos: LatLon;

  /**
   * Estimated position based on course and speed
   */
  estimated?: LatLon;

  /**
   * The course vector for this vessel
   */
  courseVector?: CourseVector;

  /**
   * Relative motion vector (RMV) showing vessel motion relative to our boat
   */
  rmv?: CourseVector;

  /**
   * CPA (Closest Point of Approach) data
   */
  cpadata: Cpa;

  /**
   * Timestamp of last computation
   */
  timestamp?: number;

  /**
   * Whether this vessel is in a warning state
   */
  warning?: boolean;

  /**
   * Whether this vessel has the lowest TCPA warning
   */
  nextWarning?: boolean;

  /**
   * Whether this is the nearest vessel
   */
  nearest?: boolean;

  /**
   * Whether this vessel is being tracked
   */
  tracking?: boolean;

  /**
   * Age of the data in seconds
   */
  age?: number;

  /**
   * Whether this vessel's data is considered lost/stale
   */
  lost?: boolean;

  /**
   * Distance to our boat in meters
   */
  distance?: number;

  /**
   * Heading/bearing from our boat to this vessel in degrees
   */
  headingTo?: number;

  /**
   * Whether this item should be handled/displayed
   */
  shouldHandle?: boolean;

  /**
   * Whether this item is hidden from display
   */
  hidden?: boolean;

  /**
   * Priority value (lower is higher priority)
   */
  priority?: number;

  /**
   * Whether the position is estimated rather than received
   */
  fromEstimated: boolean;

  /**
   * MMSI (Maritime Mobile Service Identity) number
   */
  mmsi?: string;
}

/**
 * AIS option mappings configuration
 */
export interface AisOptionMappings {
  minAISspeed?: number;
  useRhumbLine?: boolean;
  onlyShowMoving?: boolean;
  showA?: boolean;
  showB?: boolean;
  showOther?: boolean;
  hideTime?: number;
  cpaEstimated?: boolean;
  warningDist?: number;
  warningTime?: number;
  courseVectorTime?: number;
  useCourseVector?: boolean;
  lostTime?: number;
  curved?: boolean;
  rmvRange?: number;
  navUrl?: string;
  markAll?: boolean;
}

/**
 * Options passed to AIS computation functions
 */
export interface AisComputationOptions {
  minAISspeed: number;
  useRhumbLine: boolean;
  onlyShowMoving: boolean;
  showA: boolean;
  showB: boolean;
  showOther: boolean;
  hideTime: number;
  cpaEstimated: boolean;
  warningDist: number;
  warningTime: number;
  courseVectorTime: number;
  useCourseVector: boolean;
  lostTime: number;
  curved: boolean;
  rmvRange: number;
  navUrl?: string;
  markAll: boolean;
}
export const NM=1852;

/**
 * AIS proxy item - a view interface combining AISItem and Cpa data
 * Used in aisformatter for formatting and display purposes
 */
export interface AisProxyItem extends Omit<AISItem,'received'|'cpadata'>,Cpa{
    type?:number,
    name?:string,
    shipname?:string,
    mmsi?:string,
    distance?:number,
    heading?:number,
    turn?:number,
    speed?:number,
    course?:number,
    headingTo?:number,
    callsign?:string
    shiptype?:number,
    status?:number,
    lon?:number,
    lat?:number,
    destination?:string,
    length?:number,
    beam?:number,
    draught?:number,
    aid_type?:number,
}