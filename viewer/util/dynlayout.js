/**
 * Created by andreas on 17.11.16.
 */


var ItemDescription=function(item,width,height,margin,hmargin,opt_isColumn){
    /**
     * @type {boolean} if true: main is width
     */
    this.isColumn=opt_isColumn||false;
    /**
     * @type  {object} the HTML element
     */
    this.item=item;
    /**
     * @type {number} the outer width
     */
    this.width=width;
    /**
     * @type {number} the outer height
     */
    this.height=height;
    /**
     * @type {number} the margin
     */
    this.marginwidth=margin;
    /**
     * @type {number} the height margin
     */
    this.marginheight=hmargin;
};
ItemDescription.prototype.getValue=function(opt_other){
    if ((!this.isColumn && ! opt_other) || (opt_other && this.isColumn)) return this.width;
    else return this.height;
};
ItemDescription.prototype.getMargin=function(opt_other){
    if ((!this.isColumn && ! opt_other) || (opt_other && this.isColumn)) return this.marginwidth;
    else return this.marginheight;
};
/**
 * a layout handler for a multi line row layout
 * @param selector a jQuery selector for the parent
 * @param itemSelector a jquery Selector for the children. If omitted - use the direct children
 * @param opt_parameters - default options - @see layout
 *     direction: left|right - default left
 *     inverted: true|false - use the elements in inverse order - default false
 *     scale: true|false - expand elements default true
 */
var rowLayout=function(selector,itemSelector,opt_parameters){
    /** @private */
    this._selector=selector;
    /** @private */
    this._itemSelector=itemSelector;
    /** @private */
    this._initialized=false;
    /** @private */
    this._options=avnav.assign({
        maxRowCol:1,
        direction:'left',
        inverted:false,
        outerSize:0,
        scale: true
    },opt_parameters);
    /**@type {ItemDescription[]}
     * @private
     **/
    this._items=[];
    /** @private */
    this._multiCss='top';
    /** @private */
    this._scalingProperty='width';
    if (this._options.direction == 'top' || this._options.direction == 'bottom') {
        /** @private */
        this._scalingProperty='height';
        /** @private */
        this._multiCss = 'left';
    }
};
/** @private */
rowLayout.prototype._addItem=function(item){
    if (! $(item).is(':visible')) return;
    var width=$(item).outerWidth(true);
    var height=$(item).outerHeight(true);
    var itemDescription=new ItemDescription(
        item,
        width,
        height,
        width-$(item).outerWidth(false),
        height-$(item).outerHeight(false),
        this._scalingProperty != 'width'
    );
    this._items.push(itemDescription);
};
/**
 * initialize the items
 * the items need to be in their initial state - i.e. never used by the layout before
 */
rowLayout.prototype.init=function(){
    this._items=[];
    var self=this;
    if (this._itemSelector){
        $(this._selector).find(this._itemSelector).each(function(idx,el){
            self._addItem(el);
        });
    }
    else{
        $(this._selector).children().each(function(idx,el){
            self._addItem(el);
        });
    }
    this._initialized=true;
};

/**
 * remove all items and set to the uninitialized state
 * will remove all styles we have set
 */
rowLayout.prototype.reset=function(){
    if (! this._initialized) return;
    var self=this;
    this._items.forEach(function(item){
        $(item.item).css(self._options.direction, '').css(self._scalingProperty, '')
            .css(self._multiCss,'').css('opacity','').css('position','');
    });
    $(this._selector).css('width','').css('height','');
    this._items=[];
    this._initialized=false;
};

/**
 * really do the layout
 * @param {object} parameters the layout parameters
 *     direction: left|right - default left
 *     inverted: true|false - use the elements in inverse order - default false
 *     maxRowCol: 1...n the number of allowed rows, default 1
 *     outerSize: the width of the outer element
 *     maxSize: if set use this instead of the container size
 */
rowLayout.prototype.layout=function(parameters) {
    var options=avnav.assign({},this._options);
    avnav.assign(options,parameters);
    if (! this._options.scale){
        //if we do not scale we can rescan each time
        this.init();
    }
    if (! this._initialized) return;
    if (!this._items.length) return;
    var maxRowCol=options.maxRowCol;
    var direction=options.direction;
    var inverted=options.inverted;
    var rowColIndex,accumulatedWidthHeight,rowHeightWidth;
    var lastVisible=inverted?this._items.length:-1;
    var topLeftPosition=0;
    var rowStartIndex=inverted?this._items.length-1:0;
    var increment=inverted?-1:1;
    var i=0;
    var maxWidthHeight;
    var setMainSize=false;
    if (options.maxSize === undefined){
        maxWidthHeight=this._scalingProperty=='width'?$(this._selector).width():$(this._selector).height();
    }
    else{
        maxWidthHeight=options.maxSize;
        if (! this._options.scale) setMainSize=true;
    }
    var item;
    var visibleItems;
    for (rowColIndex=0;rowColIndex<maxRowCol;rowColIndex++){
        visibleItems=[];
        rowHeightWidth=0;
        elementPosition=0;
        accumulatedWidthHeight=0;
        for(i=lastVisible+increment;i>=0 && i < this._items.length;i+=increment){
            item=this._items[i];
            if ((item.getValue()+accumulatedWidthHeight)> maxWidthHeight){
                break;
            }
            lastVisible=i;
            accumulatedWidthHeight+=item.getValue();
            if (item.getValue(true) > rowHeightWidth) rowHeightWidth=item.getValue(true);
            visibleItems.push(item);
        }
        if (visibleItems.length < 1) continue;
        var vLen=visibleItems.length;
        var first=(options.outerSize && visibleItems.length > 1 && options.outerSize < maxWidthHeight/2);
        var usableOuterElementSize=first?options.outerSize:0;
        //if we resize the outer element - remove the outer one from the width for the factor
        var factor=1;
        if (this._options.scale) {
            if (usableOuterElementSize > 0) {
                accumulatedWidthHeight -= visibleItems[vLen - 1].getValue();
                //all elements without the last (but with the margin of the last) must fit into maxWidth-usableOuterElementSize
                factor = (accumulatedWidthHeight > 0) ? (maxWidthHeight - usableOuterElementSize - visibleItems[vLen - 1].getMargin() ) / (accumulatedWidthHeight) : 1;
            }
            else {
                factor = (accumulatedWidthHeight > 0) ? (maxWidthHeight) / (accumulatedWidthHeight) : 1;
            }
            if (factor < 0) factor = 1
        }
        var elementPosition=0;
        for (i=vLen-1;i>=0;i--){
            item=visibleItems[i];
            var niWidthHeight=first?usableOuterElementSize:(item.getValue()*factor-item.getMargin());
            $(item.item).css('position', 'absolute')
                .css(direction, elementPosition + "px")
                .css(this._multiCss,topLeftPosition+"px").css('opacity',1);
            if (this._options.scale){
                $(item.item).css(this._scalingProperty, niWidthHeight);
            }
            first=false;
            elementPosition += niWidthHeight + item.getMargin();
        }
        topLeftPosition+=rowHeightWidth;
    }
    var selectorProperty=this._multiCss=='top'?'height':'width';
    $(this._selector).css(selectorProperty,topLeftPosition+"px");
    if (setMainSize){
        $(this._selector).css(this._scalingProperty,accumulatedWidthHeight+"px");
    }
    for (i=lastVisible+increment; i < this._items.length && i >= 0; i+=increment) {
        $(this._items[i].item).css('opacity',0);
    }
};

module.exports=rowLayout;
