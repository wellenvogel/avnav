/**
 * Created by andreas on 20.11.16.
 */
var React=require('react');
var ReactDom=require('react-dom');
var Factory=require('./WidgetFactory.jsx');
var DynLayout=require('../util/dynlayout');

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

var rectWrapper=function(rect,index){
    this.rect=rect;
    this.index=index;
};
rectWrapper.prototype.getValue=function(what,opt_other){
    if (! this.rect) return 0;
    return this.rect[this.getKey(what,opt_other)];
};
rectWrapper.prototype.getKey=function(what,opt_swap){
    if (! opt_swap) return what;
    var swp={
        width:'height',
        height: 'width'
    };
    return swp[what];
};

var getValue=function(rect,v){
    return rect[v];
};
/**
 *
 * @param itemList a list of boundingRects - object with keys...
 * @param {object} parameters the layout parameters
 *     direction: left|right - default left
 *     inverted: true|false - use the elements in inverse order - default false
 *     maxRowCol: 1...n the number of allowed rows, default 1
 *     outerSize: the width of the outer element
 *     maxSize: if set use this instead of the container size
 *     inverseAlignment: align to bottom instead of top, right instead of left
 *     containerClass: classes to be added to the container
 *     mainMargin: margin in px for main direction
 *     otherMargin: margin in px for other direction
 */
var layout=function(items,parameters) {
    var styles={};
    var options=avnav.assign({},parameters);
    if (options.layoutParameterCallback){
        avnav.assign(options,options.layoutParameterCallback(this));
    }
    var layoutParameter=new LayoutParameters(options);
    var numItems = 0;
    for (var k in items) if (items.hasOwnProperty(k)) ++numItems;
    if (!numItems) return styles;
    var maxRowCol=options.maxRowCol;
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
    for (rowColIndex=0;rowColIndex<maxRowCol;rowColIndex++){
        visibleItems=[];
        rowHeightWidth=0;
        elementPosition=0;
        accumulatedWidthHeight=0;
        for(i=lastVisible+increment;i>=0 && i < numItems;i+=increment){
            item=new rectWrapper(items[i],i);
            if ((item.getValue(layoutParameter.scalingProperty)+accumulatedWidthHeight +(options.mainMargin||0)/2)> maxWidthHeight){
                break;
            }
            lastVisible=i;
            accumulatedWidthHeight+=item.getValue(layoutParameter.scalingProperty);
            accumulatedWidthHeight+=options.mainMargin||0;
            if (item.getValue(layoutParameter.scalingProperty, true) > rowHeightWidth)
                rowHeightWidth=item.getValue(layoutParameter.scalingProperty, true);
            visibleItems.push(item);
        }
        if (accumulatedWidthHeight >= (options.mainMargin||0)/2) accumulatedWidthHeight-=options.mainMargin||0/2;
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
                options.mainMargin||0 ) / (accumulatedWidthHeight) : 1;
            }
            else {
                factor = (accumulatedWidthHeight > 0) ? (maxWidthHeight) / (accumulatedWidthHeight) : 1;
            }
            if (factor < 0) factor = 1
        }
        var elementPosition=0;
        for (i=vLen-1;i>=0;i--){
            item=visibleItems[i];
            var niWidthHeight=first?usableOuterElementSize:(item.getValue(layoutParameter.scalingProperty)*factor);
            styles[item.index]={
                position:'absolute',
                opacity:1,
                zIndex:2
            };
            var style=styles[item.index];
            avnav.assign(style,layoutParameter.positionProperties(elementPosition,topLeftPosition));
            if (options.scale){
                avnav.assign(style,layoutParameter.scaleProperties(niWidthHeight));
            }
            first=false;
            elementPosition += niWidthHeight +options.mainMargin||0;
        }
        topLeftPosition+=rowHeightWidth+options.otherMargin||0;
    }
    for (i=lastVisible+increment; i < numItems && i >= 0; i+=increment) {
        styles[i]={
            opacity:0,
            zIndex:1
        };
    }
    return styles;
};


var WidgetContainer=function(reactProperties: Object,domId: String,opt_layoutHandler: DynLayout) {
    var self=this;
    var container=this;
    /**
     * the react properties
     * @type {Object}
     * @private
     */
    this._reactProperties = reactProperties;
    /**
     * the dom id where we render to
     * @type {String}
     * @private
     */
    this._domId = domId;
    /**
     * the layout handler assigned
     * @type {DynLayout}
     */
    this._layoutHandler = opt_layoutHandler;
    /**
     * @private
     */
    this._reactFactory = React.createClass({
        propTypes: {
            onClick: React.PropTypes.func.isRequired,
            items: React.PropTypes.array.isRequired,
            updateCallback: React.PropTypes.func,
            layoutParameterCallback: React.PropTypes.func,
            store: React.PropTypes.object.isRequired,
            propertyHandler: React.PropTypes.object.isRequired
        },
        getInitialState: function(){
            this.itemInfo={};
            this.layouts={};
            var visible={};
            this.props.items.forEach(function(item){
                visible[item]=true;
            });
            return{
                items:this.props.items,
                visibility: visible,
                dummy:1
            }
        },
        updateItemInfo:function(key,data){
            if (! this.itemInfo) this.itemInfo={};
            if (! this.itemInfo[key]) this.itemInfo[key]=data;
        },
        removeItemInfo:function(key){
            /*
            if (! this.itemInfo) this.itemInfo={};
            delete this.itemInfo[key];
            if (! this.layouts) return;
            delete this.layouts[key];
            */
        },
        computeStyles:function(){
            var layoutParam={};
            if (this.props.layoutParameterCallback){
                layoutParam=this.props.layoutParameterCallback();
            }
            if (self._layoutHandler._options.layoutParameterCallback){
                layoutParam=avnav.assign({},self._layoutHandler._options,self._layoutHandler._options.layoutParameterCallback());
            }
            this.layouts=layout(this.itemInfo,layoutParam);
            return this.layouts;
        },
        render: function () {
            var self = this;
            var styles=this.computeStyles();
            var key=0;
            var rt= (
                <div>
                    {this.state.items.map(function (item) {
                        var itemKey=key;
                        key++;
                        var style=styles[itemKey];
                        if (! style){
                            style={
                                opacity: 0.5,
                                backgroundColor: 'grey'
                            }
                        }
                        if (self.state.visibility[item]) {
                            var widget = Factory.createWidget(item, {
                                store: self.props.store,
                                propertyHandler: self.props.propertyHandler,
                                layoutUpdate: container.layout,
                                style: style
                            }, function (data) {
                                self.widgetClicked(item, data);
                            }, function(create,rect){
                                if (create) self.updateItemInfo(itemKey,rect);
                                else self.removeItemInfo(itemKey);
                            }
                            );
                            return widget;
                        }
                        return <div key={name}></div>
                    })}
                </div>
            );
            return rt;
        },
        widgetClicked: function (widgetName, data) {
            this.props.onClick(Factory.findWidget(widgetName), data);
        },
        componentDidMount: function () {
            if (this.props.updateCallback) {
                this.props.updateCallback();
            }
            /*
            if (self._layoutHandler){
                self._layoutHandler.init();
            }
            */
            this.componentDidUpdate();
        },
        checkUnlayouted:function(){
            var self=this;
            var hasUnlayouted=false;
            if (! this.itemInfo) this.itemInfo={};
            if (! this.layouts) this.layouts={};
            for (var i in this.itemInfo){
                if (! this.layouts[i]) hasUnlayouted=true;
            }
            if (hasUnlayouted){
                window.setTimeout(function(){
                    self.setState({
                        dummy:1
                    })
                },0)
            }
        },
        componentDidUpdate:function(){

            /*
            if (self._layoutHandler){
                self._layoutHandler.layout();
            }
            */
            this.checkUnlayouted();
        },
        setItems:function(newItems){
            var visibility={};
            newItems.forEach(function(item){
               visibility[item]=true;
            });
            this.setState({
                items: newItems,
                visibility: visibility
            });
        },
        setVisibility:function(newVisibility){
            var current=avnav.assign({},this.state.visibility,newVisibility);
            var changed=false;
            var k;
            for (k in current){
                if (this.state.visibility[k] != current[k]){
                    changed=true;
                    break;
                }
            }
            if (! changed) return;
            this.setState({
                visibility: current
            });
        }



    });
    this._instance=undefined;
    this.layout=this.layout.bind(this);
};
WidgetContainer.prototype.render=function(){
    var container=React.createElement(this._reactFactory,this._reactProperties);
    var dom=avnav.isString(this._domId)?document.getElementById(this._domId):this._domId;
    this._instance=ReactDom.render(container,dom);
    return this._instance;
};
WidgetContainer.prototype.layout=function(param){
    //if (this._layoutHandler) this._layoutHandler.layout(param);
    if (this._instance){
        this._instance.setState({
            dummy:1
        });
    }
};

WidgetContainer.prototype.getItems=function(){
  return this._reactProperties.items;
};

WidgetContainer.prototype.setItems=function(newItems){
    if (! newItems) newItems=[];
    if (this._instance) {
        this._reactProperties.items=newItems;
        this._instance.setItems(newItems);
        return this._instance;
    }
    this._reactProperties=newItems;
    return this.render();
};
WidgetContainer.prototype.removeItem=function(item){
    if (! item) return;
    var i=0;
    var items=this._reactProperties.items.slice(0);
    for (i=0;i<items.length;i++){
        if (items[i] == item){
            return this.setItems(items.splice(i,1));
        }
    }
};

WidgetContainer.prototype.insertAfter=function(after,item){
    if (! item) return;
    var i=0;
    var items=this._reactProperties.items.slice(0);
    if (after) {
        for (i = 0; i < items.length; i++) {
            if (items[i] == after) {
                return this.setItems(items.splice(i, 1, item));
            }
        }
        items.push(item);
    }
    else{
        items.unshift(item);
    }
    return this.setItems(items);
};
/**
 * change the visibility of an item
 * @param {object} newVisibility
 */
WidgetContainer.prototype.setVisibility=function(newVisibility){
    if (! this._instance) return;
    this._instance.setVisibility(newVisibility);
};
/**
 *
 * @returns {DynLayout}
 */
WidgetContainer.prototype.getLayout=function(){
    return this._layoutHandler;
};
module.exports=WidgetContainer;