/**
 * Created by andreas on 17.11.16.
 */


var ItemDescription=function(item,width,height,margin){
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
    this.margin=margin;
};
/**
 * a layout handler for a multi line row layout
 * @param selector a jQuery selector for the parent
 * @param itemSelector a jquery Selector for the children. If omitted - use the direct children
 * @param opt_parameters - default options - @see layout
 */
var rowLayout=function(selector,itemSelector,opt_parameters){
    this._selector=selector;
    this._itemSelector=itemSelector;
    this._initialized=false;
    this._options=opt_parameters||{};
    /**@type {ItemDescription[]} */
    this._items=[];
};

rowLayout.prototype._addItem=function(item){
    var width=$(item).outerWidth(true);
    var itemDescription=new ItemDescription(
        item,
        width,
        $(item).outerHeight(true),
        width-$(item).outerWidth(false)
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
 * TODO: remove styles from items
 */
rowLayout.prototype.reset=function(){
    if (! this._initialized) return;
    this._items=[];
    this._initialized=false;
};

/**
 * really do the layout
 * @param {object} parameters the layout parameters
 *     direction: left|right - default left
 *     inverted: true|false - use the elements in inverse order - default false
 *     maxRows: 1...n the number of allowed rows, default 1
 *     outerSize: the width of the outer element
 */
rowLayout.prototype.layout=function(parameters) {
    var options=avnav.assign({},this._options);
    avnav.assign(options,parameters);
    if (! this._initialized) return;
    if (!this._items.length) return;
    var maxRows=options.maxRows||1;
    var direction=options.direction||'left';
    var inverted=options.inverted||false;
    var rowIndex,accumulatedWidth,rowHeight;
    var lastVisible=inverted?this._items.length:-1;
    var topPosition=0;
    var rowStartIndex=inverted?this._items.length-1:0;
    var increment=inverted?-1:1;
    var i=0;
    var maxWidth=$(this._selector).width();
    var item;
    var visibleItems;
    for (rowIndex=0;rowIndex<maxRows;rowIndex++){
        visibleItems=[];
        rowHeight=0;
        elementPosition=0;
        accumulatedWidth=0;
        for(i=lastVisible+increment;i>=0 && i < this._items.length;i+=increment){
            item=this._items[i];
            if ((item.width+accumulatedWidth)> maxWidth){
                break;
            }
            lastVisible=i;
            accumulatedWidth+=item.width;
            if (item.height > rowHeight) rowHeight=item.height;
            visibleItems.push(item);
        }
        if (visibleItems.length < 1) continue;
        var vLen=visibleItems.length;
        var first=(options.outerSize && visibleItems.length > 1);
        var usableOuterElementSize=first?options.outerSize:0;
        //if we resize the outer element - remove the outer one from the width for the factor
        var factor=1;
        if (usableOuterElementSize > 0 ) {
            accumulatedWidth -= visibleItems[vLen-1].width;
            //all elements without the last (but with the margin of the last) must fit into maxWidth-usableOuterElementSize
            var allMargins=0;
            for (i=0;i<(visibleItems.length-1);i++) allMargins+=visibleItems[i].margin;
            factor = (accumulatedWidth > 0) ? (maxWidth - usableOuterElementSize - visibleItems[vLen-1].margin ) / (accumulatedWidth) : 1;
        }
        else {
            factor = (accumulatedWidth > 0) ? (maxWidth) / (accumulatedWidth) : 1;
        }
        if (factor < 0) factor = 1;
        var elementPosition=0;
        for (i=vLen-1;i>=0;i--){
            item=visibleItems[i];
            var niWidth=first?usableOuterElementSize:(item.width*factor-item.margin);
            $(item.item).css('position', 'absolute')
                .css(direction, elementPosition + "px").css('width', niWidth)
                .show().css('top',topPosition+"px");
            first=false;
            elementPosition += niWidth + item.margin;
        }
        topPosition+=rowHeight;
    }
    $(this._selector).css('height',topPosition+"px");
    for (i=lastVisible+increment; i < this._items.length && i >= 0; i+=increment) {
        $(this._items[i].item).hide();
    }
};

module.exports=rowLayout;
