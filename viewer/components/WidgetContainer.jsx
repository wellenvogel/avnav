/**
 * Created by andreas on 20.11.16.
 */
var React=require('react');
var LayoutMonitor=require('./LayoutMonitor.jsx');

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

var ItemWrapper=function(rect,item){
    this.rect=rect;
    this.item=item;
};
ItemWrapper.prototype.getValue=function(what,opt_other){
    if (! this.rect) return 0;
    return this.rect[this.getIndex(what,opt_other)];
};
ItemWrapper.prototype.getIndex=function(what,opt_swap){
    if (! opt_swap) return what;
    var swp={
        width:'height',
        height: 'width'
    };
    return swp[what];
};
ItemWrapper.prototype.getKey=function(){
    return this.item.key;
};


/**
 *
 * @param {ItemWrapper[]} itemList an array of objects to be rendered - object with keys...
 * @param {object} parameters the layout parameters
 *     direction: left|right - default left
 *     inverted: true|false - use the elements in inverse order - default false
 *     maxRowCol: 1...n the number of allowed rows, default 1
 *     outerSize: the width of the outer element
 *     maxSize: if set use this for computing scaling
 *     inverseAlignment: align to bottom instead of top, right instead of left
 *     containerClass: classes to be added to the container
 *     mainMargin: margin in px for main direction
 *     otherMargin: margin in px for other direction
 *     scale: if set - scale items
 * @returns and object with container: main,other and styles - an object of element styles
 */
var layout=function(itemList,parameters) {
    var styles={};
    var options=avnav.assign({},parameters);
    var layoutParameter=new LayoutParameters(options);
    var numItems = itemList.length;
    if (!numItems) return {
        container: { main:0,other:0},
        styles: styles
    };
    var maxRowCol=options.maxRowCol;
    if (maxRowCol === undefined) maxRowCol=1;
    var direction=options.direction;
    var inverted=options.inverted;
    var rowColIndex,accumulatedWidthHeight,rowHeightWidth;
    var lastVisible=inverted?numItems:-1;
    var topLeftPosition=0;
    var rowStartIndex=inverted?numItems-1:0;
    var increment=inverted?-1:1;
    var i=0;
    var setMainSize=false;
    var maxWidthHeight=options.maxSize;
    var item;
    var visibleItems;
    var mainMargin=options.mainMargin||0;
    var otherMargin=options.otherMargin||0;
    var containerMain=undefined;
    for (rowColIndex=0;rowColIndex<maxRowCol;rowColIndex++){
        visibleItems=[];
        rowHeightWidth=0;
        elementPosition=0;
        accumulatedWidthHeight=0;
        for(i=lastVisible+increment;i>=0 && i < numItems;i+=increment){
            item=itemList[i];
            if ((item.getValue(layoutParameter.scalingProperty)+accumulatedWidthHeight +mainMargin)> maxWidthHeight &&
                maxWidthHeight >0){
                break;
            }
            lastVisible=i;
            accumulatedWidthHeight+=item.getValue(layoutParameter.scalingProperty);
            accumulatedWidthHeight+=mainMargin;
            if (item.getValue(layoutParameter.scalingProperty, true) > rowHeightWidth)
                rowHeightWidth=item.getValue(layoutParameter.scalingProperty, true);
            visibleItems.push(item);
        }
        if (containerMain === undefined || accumulatedWidthHeight > containerMain) containerMain=accumulatedWidthHeight;
        if (visibleItems.length < 1) continue;
        var vLen=visibleItems.length;
        var first=(options.outerSize && visibleItems.length > 1 && options.outerSize < maxWidthHeight/2 && options.scale);
        var usableOuterElementSize=first?options.outerSize:0;
        //if we resize the outer element - remove the outer one from the width for the factor
        var factor=1;
        if (options.scale) {
            //scale handling: as we do not scale margins, we have to subtract n times margin from both
            //the other size and the computed size
            var scaleMaxSize=maxWidthHeight-vLen*mainMargin;
            accumulatedWidthHeight-=vLen*mainMargin;
            if (usableOuterElementSize > 0) {
                accumulatedWidthHeight -= visibleItems[vLen - 1].getValue(layoutParameter.scalingProperty);
                //all elements without the last must fit into maxWidth-usableOuterElementSize
                factor = (accumulatedWidthHeight > 0) ? ((scaleMaxSize - usableOuterElementSize)  / accumulatedWidthHeight) : 1;
            }
            else {
                factor = (accumulatedWidthHeight > 0) ? (scaleMaxSize) / (accumulatedWidthHeight) : 1;
            }
            if (factor < 0) factor = 1
        }
        var elementPosition=0;
        for (i=vLen-1;i>=0;i--){
            item=visibleItems[i];
            var niWidthHeight=first?usableOuterElementSize:(item.getValue(layoutParameter.scalingProperty)*factor);
            styles[item.getKey()]={
                position:'absolute',
                opacity:1,
                zIndex:2
            };
            var style=styles[item.getKey()];
            avnav.assign(style,layoutParameter.positionProperties(elementPosition,topLeftPosition));
            if (options.scale){
                avnav.assign(style,layoutParameter.scaleProperties(niWidthHeight));
            }
            first=false;
            elementPosition += niWidthHeight +mainMargin;
        }
        topLeftPosition+=rowHeightWidth+otherMargin;
    }
    for (i=lastVisible+increment; i < numItems && i >= 0; i+=increment) {
        styles[itemList[i].getKey()]={
            opacity:0,
            zIndex:1
        };
    }
    return {
        container:{ other: topLeftPosition,main:containerMain},
        styles:styles
    };
};


var WidgetContainer=React.createClass({
        propTypes: {
            onClick: React.PropTypes.func.isRequired,
            /**
             * a list of item properties
             * must contain: key
             */
            itemList: React.PropTypes.array.isRequired,
            itemCreator: React.PropTypes.func.isRequired,
            updateCallback: React.PropTypes.func,
            layoutParameter: React.PropTypes.object,
            store: React.PropTypes.object.isRequired,
            propertyHandler: React.PropTypes.object.isRequired,
            dummy: React.PropTypes.any,
            renewSequence: React.PropTypes.number
        },
        getInitialState: function(){
            this.itemInfo={};
            this.layouts={};
            this.renderedItems=[];
            return {};
        },
        componentWillReceiveProps:function(nextProps){
            if (nextProps.renewSequence !== undefined && nextProps.renewSequence != this.props.renewSequence){
                this.itemInfo={};
                this.layouts={};
            }
        },
        updateItemInfo:function(key,data,opt_force){
            if (! this.itemInfo) this.itemInfo={};
            if (this.itemInfo[key] == null){
                this.itemInfo[key]=data;
                this.checkUnlayouted();
                return;
            }
            if (opt_force){
                if (this.itemInfo[key] != null && data == null){
                    this.itemInfo[key]=data;
                    delete this.layouts[key];
                    this.checkUnlayouted(true);
                    return;
                }
            }
            if (! this.itemInfo[key] || opt_force) {
                this.itemInfo[key]=data;
                this.checkUnlayouted();
            }
        },
        removeItemInfo:function(key){
        },
        computeStyles:function(){
            var layoutParam={};
            if (this.props.layoutParameter){
                layoutParam=this.props.layoutParameter;
            }
            var items=[];
            this.renderedItems=[];
            if (! this.props.itemList){
                this.renderedItems=[];
                this.layouts={};
                return;
            }
            for (var i in this.props.itemList){
                var item=this.props.itemList[i];
                if (! item.key){
                    avnav.log("missing item key");
                    continue;
                }
                var rect=this.itemInfo[item.key];
                this.renderedItems.push(item);
                if (rect) items.push(new ItemWrapper(rect,item))
            }
            var layouts=layout(items,layoutParam);
            this.layouts=layouts.styles;
            this.container=layouts.container;
        },
        render: function () {
            var self = this;
            this.computeStyles();
            var styles=this.layouts;
            var rt= (
                <div>
                    {this.renderedItems.map(function (item) {
                        var itemKey=item.key;
                        var style=styles[itemKey];
                        if (! style){
                            style={
                                opacity: 0,
                                backgroundColor: 'grey',
                                zIndex:1
                            }
                        }
                        var renderItem=self.props.itemCreator(item);
                        var element=React.createElement(LayoutMonitor(renderItem.element,function(rect,opt_force){
                                self.updateItemInfo(itemKey, rect, opt_force);
                        }),avnav.assign({},renderItem.props, {
                            store: self.props.store,
                            propertyHandler: self.props.propertyHandler,
                            style: style,
                            onClick: function (data) {
                                self.widgetClicked(item,data);
                            },
                            renewSequence: self.props.renewSequence||0
                        }));
                        return element;
                    })}
                </div>
            );
            return rt;
        },
        widgetClicked: function (item, data) {
            this.props.onClick(item, data);
        },
        componentDidMount: function () {
            if (this.props.updateCallback && this.container) {
                this.props.updateCallback(this.container);
            }
            /*
            if (self._layoutHandler){
                self._layoutHandler.init();
            }
            */
            this.componentDidUpdate();
        },
        checkUnlayouted:function(opt_nullAsUnlayouted){
            var self=this;
            var hasUnlayouted=false;
            if (! this.renderedItems) return;
            for (var i in this.renderedItems){
                var key=this.renderedItems[i].key;
                if (key && (! this.layouts || ! this.layouts[key] )) {
                    //we have items that currently hav no dom with itemInfo null
                    //we simply rely on some state to change...
                    if (! (this.itemInfo[key] == null) || opt_nullAsUnlayouted) {
                        hasUnlayouted=true;
                    }
                }
            }
            if (hasUnlayouted && ! this.delayedUpdate){
                this.delayedUpdate=window.setTimeout(function(){
                    self.delayedUpdate=undefined;
                    self.setState({
                        dummy:1
                    })
                },0)
            }
        },
        componentDidUpdate:function(){
            this.checkUnlayouted();
            if (this.container && this.props.updateCallback){
                this.props.updateCallback(this.container);
            }
        }
    });
module.exports=WidgetContainer;