/**
 * Created by andreas on 17.11.16.
 */


var ItemDescription=function(item,width,height,margin,hmargin){

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
ItemDescription.prototype.getValue= function (scalingProperty, opt_other){
    if ((scalingProperty == 'width' && ! opt_other) || (opt_other && scalingProperty != 'width')) return this.width;
    else return this.height;
};
ItemDescription.prototype.getMargin=function(scalingProperty,opt_other){
    if ((scalingProperty == 'width' && ! opt_other) || (opt_other && scalingProperty != 'width')) return this.marginwidth;
    else return this.marginheight;
};

var LayoutParameters=function(options){
    this.scale=options.scale;
    this.direction=options.direction;
    this.scalingProperty='width';
    this.multiCss='top';
    if (options.inverseAlignment) this.multiCss='bottom';
    this.containerDimension='height';
    if (options.direction == 'top' || options.direction == 'bottom') {
        this.scalingProperty='height';
        this.multiCss = 'left';
        if (options.inverseAligment) this.multiCss='right';
        this.containerDimension='width';
    }
    if (options.maxSize !== undefined && !options.scale){
        this.scaleContainer=true;
    }
};
LayoutParameters.prototype.positionProperties=function(position,multiPosition){
    var rt={left:'',top:'',bottom:'',right:''};
    rt[this.direction]=position+"px";
    rt[this.multiCss]=multiPosition+"px";
    return rt;
};
LayoutParameters.prototype.scaleProperties=function(size){
    var rt={width:'',height:''};
    rt[this.scalingProperty]=size+"px";
    return rt;
};
LayoutParameters.prototype.resetParameters=function(){
    var rt={left:'',top:'',bottom:'',right:''};
    if (this.scale){
        rt.width='';
        rt.height='';
    }
    return rt;
};
LayoutParameters.prototype.containerDimensionProperties=function(size,opt_otherSize){
    var rt={width:'',height:''};
    rt[this.containerDimension]=size+"px";
    if (this.scaleContainer){
        rt[this.scalingProperty]=opt_otherSize+"px";
    }
    return rt;
};
LayoutParameters.prototype.containerResetProperties=function(){
    var rt={width:'',height:''};
    return rt;
};
/**
 * a layout handler for a multi line row layout
 * we can run in 2 basic modes:
 * scale enabled (scale parameter set to true):
 *    in this mode the container is not changed at all, elements are resized to fit the container
 *    if outerSize is given, the outermost element is set to this size
 *    this mode is unable to deal with changes in element sizes.
 *    To adapt to changed elements you need to call reset/init again
 * scale disabled:
 *    In this mode the container is adapted in its size if you specify the maxSize parameter in the layout call.
 *    As the element sizes are never changed, elements will be rescanned on every layout. This way it will automatically
 *    detect changed element sizes
 *
 * @param selector a jQuery selector for the parent
 * @param itemSelector a jquery Selector for the children. If omitted - use the direct children
 * @param opt_parameters - default options - @see layout
 *     direction: left|right - default left
 *     inverted: true|false - use the elements in inverse order - default false
 *     scale: true|false - expand elements default true
 *     layoutParameterCallback: function that will return layout parameter
 *     all parameters except scale can be overwritten in the layout call
 */
var DynLayout=function(selector, itemSelector, opt_parameters){
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
    /**
     * remember classes we added during layout to remove them
     * @type {string}
     * @private
     */
    this._assignedContainerClasses='';
};

DynLayout.prototype._getParameter=function(options){
    return new LayoutParameters(options);
};
/** @private */
DynLayout.prototype._addItem=function(item){
    if (! $(item).is(':visible')) return;
    var width=$(item).outerWidth(true);
    var height=$(item).outerHeight(true);
    var itemDescription=new ItemDescription(
        item,
        width,
        height,
        width-$(item).outerWidth(false),
        height-$(item).outerHeight(false)
    );
    this._items.push(itemDescription);
};
/**
 * initialize the items
 * the items need to be in their initial state - i.e. never used by the layout before
 */
DynLayout.prototype.init=function(){
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
DynLayout.prototype.reset=function(){
    if (! this._initialized) return;
    var self=this;
    var layoutParameter=new LayoutParameters(this._options);
    this._items.forEach(function(item){
        $(item.item).css(layoutParameter.resetParameters())
            .css('opacity','').css('position','');
    });
    $(this._selector).css(layoutParameter.containerResetProperties());
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
 *     inverseAlignment: align to bottom instead of top, right instead of left
 *     containerClass: classes to be added to the container
 */
DynLayout.prototype.layout=function(parameters) {
    if (! this._initialized) return;
    var options=avnav.assign({},this._options);
    avnav.assign(options,parameters);
    if (options.layoutParameterCallback){
        avnav.assign(options,options.layoutParameterCallback(this));
    }
    var layoutParameter=this._getParameter(options);
    if (! this._options.scale){
        //if we do not scale we can rescan each time
        this.init();
    }
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
        maxWidthHeight=layoutParameter.scalingProperty=='width'?$(this._selector).width():$(this._selector).height();
    }
    else{
        maxWidthHeight=options.maxSize;
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
            if ((item.getValue(layoutParameter.scalingProperty)+accumulatedWidthHeight)> maxWidthHeight){
                break;
            }
            lastVisible=i;
            accumulatedWidthHeight+=item.getValue(layoutParameter.scalingProperty);
            if (item.getValue(layoutParameter.scalingProperty, true) > rowHeightWidth)
                rowHeightWidth=item.getValue(layoutParameter.scalingProperty, true);
            visibleItems.push(item);
        }
        if (visibleItems.length < 1) continue;
        var vLen=visibleItems.length;
        var first=(options.outerSize && visibleItems.length > 1 && options.outerSize < maxWidthHeight/2);
        var usableOuterElementSize=first?options.outerSize:0;
        //if we resize the outer element - remove the outer one from the width for the factor
        var factor=1;
        if (options.scale) {
            if (usableOuterElementSize > 0) {
                accumulatedWidthHeight -= visibleItems[vLen - 1].getValue(layoutParameter.scalingProperty);
                //all elements without the last (but with the margin of the last) must fit into maxWidth-usableOuterElementSize
                factor = (accumulatedWidthHeight > 0) ? (maxWidthHeight - usableOuterElementSize -
                    visibleItems[vLen - 1].getMargin(layoutParameter.scalingProperty) ) / (accumulatedWidthHeight) : 1;
            }
            else {
                factor = (accumulatedWidthHeight > 0) ? (maxWidthHeight) / (accumulatedWidthHeight) : 1;
            }
            if (factor < 0) factor = 1
        }
        var elementPosition=0;
        for (i=vLen-1;i>=0;i--){
            item=visibleItems[i];
            var niWidthHeight=first?usableOuterElementSize:(item.getValue(layoutParameter.scalingProperty)*factor-item.getMargin());
            $(item.item).css('position', 'absolute')
                .css(layoutParameter.positionProperties(elementPosition,topLeftPosition))
                .css('opacity',1);
            if (this._options.scale){
                $(item.item).css(layoutParameter.scaleProperties(niWidthHeight));
            }
            first=false;
            elementPosition += niWidthHeight + item.getMargin(layoutParameter.direction);
        }
        topLeftPosition+=rowHeightWidth;
    }
    $(this._selector).css(layoutParameter.containerDimensionProperties(topLeftPosition,accumulatedWidthHeight));
    $(this._selector).removeClass(this._assignedContainerClasses);
    this._assignedContainerClasses=options.containerClass||"";
    $(this._selector).addClass(this._assignedContainerClasses);
    for (i=lastVisible+increment; i < this._items.length && i >= 0; i+=increment) {
        $(this._items[i].item).css('opacity',0);
    }
};

module.exports=DynLayout;
