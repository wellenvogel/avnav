
/**
 * # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
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
 */
export enum EventTypes {
    SELECTWP= 2,
    RELOAD= 3,
    LOAD= 4,
    FEATURE= 5,
    SHOWMAP= 6,
    HIDEMAP= 7

}

export interface MapEvent extends Record<string,any>{
    type:EventTypes,
}
export type MapEventCallback = (mapEvent: MapEvent) => void
export enum SHOW_MODE {
    never = 0,
    once = 1,
    session = 2
}
export interface ChartEntry extends Record<string,any>{
    displayName?:string
    name:string,
    url?:string,
    infoMode?:SHOW_MODE,
    info?:string,

}

export interface MapHolder {
    olmap: any;
    defaultDiv: HTMLDivElement;
    courseUp: boolean;
    transformFromMap: any;
    transformToMap: any;
    mapEventSubscriptionId: number;
    mapEventSubscriptions: Record<number, MapEventCallback>;
    userLayerContext: any;
    aislayer: any;
    navlayer: any;
    tracklayer: any;
    routinglayer: any;
    userLayer: any;
    minzoom: number;
    maxzoom: number;
    mapMinZoom: number;
    referencePoint: number[];
    boatOffset: { x: number; y: number };
    zoom: number;
    lastCenter: number[];
    requiredZoom: number;
    forceZoom: boolean;
    mapZoom: number;
    drawing: any;
    northImage: HTMLImageElement;
    routingActive: boolean;
    compassOffset: number;
    needsRedraw: boolean;
    storeKeys: string[];
    userKeys: Record<string, Record<string, string[]>>;
    gpsLocked: number;
    scaleControl: any;
    lastRender: number | undefined;
    remoteChannel: any;
    sources: any[];
    eventGuards: any[];
    warnings: Record<string, boolean>;
    
    subscribe(callback: MapEventCallback): number;
    unsubscribe(token: number): void;
    coordToPixel(point: number[]): number[];
    pixelToCoord(pixel: number[]): number[];
    pointToMap(point: number[]): number[];
    pointFromMap(point: number[]): number[];
    fromMapToPoint(coord: number[]): any;
    getView(): any;
    getZoom(): { required: number; current: number };
    getCenter(): any;
    setCenter(point: any, opt_noUserAction?: boolean, opt_offset?: { x: number; y: number }): void;
    setZoom(zoom: number, opt_force?: boolean): void;
    getGpsLock(): number;
    setGpsLock(lockMode: number, notRemote?: boolean, saveIt?: boolean): void;
    getCourseUp(): boolean;
    setCourseUp(courseUp: boolean, notRemote?: boolean): void;
    setBoatOffset(point: any): void;
    setBoatOffsetXY(x: number, y: number): void;
    getBoatOffset(): { x: number; y: number };
    getBaseChart(): any;
    getLastChartKey(): any;
    setChartEntry(entry: ChartEntry, noQueryParams?: boolean): Promise<void>;
    getCurrentChartEntry(): ChartEntry | null;
    findChartSourceForItem(item: any): any;
    getMapLayerNames(): string[];
    getBaseLayer(visible: boolean): any;
    getMapOutlineLayer(layers: any[], visible: boolean): any;
    getRoutingActive(): boolean;
    setRoutingActive(active: boolean): void;
    setCompassOffset(offset: number): void;
    setMapRotation(rotation: number, opt_anchor?: number[]): void;
    setRedraw(flag: boolean): void;
    updateSize(opt_hide?: boolean): void;
    renderTo(div: HTMLElement): void;
    initMap(div: HTMLElement, options?: any): void;
    loadMap(): Promise<any>;
    prepareSourcesAndCreate(newSources: any[]): Promise<boolean>;
    leavePageAction(): void;
    mapUserAction(): void;
    updateStoreKeys(newKeys?: any[], page?: string, name?: string): void;
    registerEventGuard(guard: any): void;
    registerKeyHandler(): void;
    deregisterKeyHandler(): void;
    saveCenter(force?: boolean): void;
    featureAction(pixel: number[], opt_fromButton?: boolean): boolean;
    onClick(evt: any): void;
    onPostCompose(evt: any): void;
    onZoomChange(evt: any): void;
    isInUserActionGuard(): boolean;
    showOverlays(): void;
    hideOverlays(): void;
    overlayStatus(): number[];
    findTargets(pixel: number[], points: any[], opt_tolerance?: number): number[];
    pixelDistance(point1: any, point2: any): number;
    setImageStyles(styles: any): void;
    triggerRender(): void;
    registerMapWidget(page: string, config: any, callback: any): void;
    unregisterPageWidgets(page: string): void;
    logError(key: string, ...error: any[]): void;
    navEvent(): void;
    userAction(): void;
}

export interface DrawingPositionConverter {
    coordToPixel(point: number[]): number[] | undefined;
    pixelToCoord(pixel: number[]): number[];
    pointToMap(point: number[]): number[];
    pointFromMap(coord: number[]): number[];
}

/**
 * Style properties for drawing lines
 */
export interface LineStyle {
    color?: string;       // CSS color for stroke
    width?: number;       // Line width in pixels
    cap?: CanvasLineCap;  // "butt" | "round" | "square"
    join?: CanvasLineJoin; // "round" | "bevel" | "miter"
    alpha?: number;       // Global alpha opacity (0-1)
    dashed?: boolean;     // If set, draw dashed line
    arrow?: boolean | ArrowStyle; // Draw arrow at end of line
    background?: string;  // Fill color for closed shapes
}

/**
 * Arrow styling for line endpoints
 */
export interface ArrowStyle {
    width?: number;   // Arrow head width in pixels
    length?: number;  // Arrow head length in pixels
    offset?: number;  // Offset from line end in pixels (default: 10)
    open?: boolean;   // If true, draw open arrow; otherwise filled
}

/**
 * Style properties for drawing text
 */
export interface TextStyle {
    color?: string;       // Text color (fill)
    stroke?: string;      // Stroke/outline color
    width?: number;       // Stroke width in pixels
    fontBase?: string;    // Font family (e.g., "Arial", "sans-serif")
    fontSize?: number;    // Font size in pixels
    alpha?: number;       // Global alpha opacity (0-1)
    align?: CanvasTextAlign;       // "left" | "center" | "right" | "start" | "end"
    baseline?: CanvasTextBaseline; // "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom"
    rotateWithView?: boolean; // If true, text rotates with map view
    offsetX?: number;     // Horizontal offset in pixels
    offsetY?: number;     // Vertical offset in pixels
    fixX?: number;        // Fixed X position (ignores point[0])
    fixY?: number;        // Fixed Y position (ignores point[1])
}

/**
 * Style properties for drawing images/icons
 */
export interface ImageStyle {
    anchor?: [number, number];  // Anchor point [x, y] in pixels
    size?: [number, number];    // Image size [width, height] in pixels
    rotation?: number;          // Rotation in radians
    rotateWithView?: boolean;   // If true, add global map rotation
    fixX?: number;              // Fixed X position (ignores point[0])
    fixY?: number;              // Fixed Y position (ignores point[1])
    alpha?: number;             // Global alpha opacity (0-1)
    background?: string;        // Background rectangle color
    backgroundAlpha?: number;   // Background alpha opacity (0-1)
    backgroundCircle?: string;  // Background circle color (instead of rectangle)
}
export interface Drawing {
    // properties
    devPixelRatio: number;
    rotation: number;
    converter: DrawingPositionConverter | any;
    context?: CanvasRenderingContext2D;
    useHdpi: boolean;
    pixelTransform?: any;

    // control
    setUseHdpi(val: boolean): void;
    getUseHdpi(): boolean;
    setDevPixelRatio(ratio: number): void;
    setPixelTransform(pixelTransform: any): void;
    setContext(context: CanvasRenderingContext2D): void;
    getContext(): CanvasRenderingContext2D | undefined;
    setRotation(angle: number): void;
    getRotation(): number;
    getDevPixelRatio(): number;

    // coordinate helpers
    pointToCssPixel(coord: number[]): number[];
    pixelToDevice(pixel: number[]): number[];
    cssPixelToCoord(xy: number[]): number[];
    pointToMap(lonlat: number[]): number[];
    pointFromMap(coord: number[]): number[];
    pointAtPixelOffset(point: number[], xoffset: number, yoffset: number): number[];

    // drawing routines
    drawCircleToContext(center: number[], other: number[], opt_styles?: LineStyle): number[] | undefined;
    drawImageToContext(point: number[], image: HTMLImageElement, opt_options?: ImageStyle): number[] | undefined;
    drawLineToContext(points: number[][], opt_style?: LineStyle): number[] | undefined;
    drawBubbleToContext(point: number[], radius: number, opt_style?: LineStyle): number[] | undefined;
    drawTextToContext(point: number[], text: string, opt_styles?: TextStyle): number[] | undefined;

    // styling helpers
    setAlpha(opt_style?: LineStyle | TextStyle | ImageStyle, opt_stylename?: string): void;
    setLineStyles(opt_style?: LineStyle): void;

    // lower level helper used internally
    arrow(x1: number, y1: number, x2: number, y2: number, w: number, l: number, pe: number, open: boolean): void;
}


