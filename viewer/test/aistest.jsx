var React=require('react');
var ReactDOM=require('react-dom');
var assign=require('object-assign');
require('../base.js');
var NavCompute=require('../nav/navcompute');
var Formatter=require('../util/formatter');
var Store=require('../util/store');
var AisData=require('../nav/aisdata');
var NavObjects=require('../nav/navobjects');
var formatter=new Formatter();
var NM=1852;
var speedKnToMs=NM/3600.0;

var XCOLOR='rgb(206, 46, 46)';
var YCOLOR='rgb(72, 142, 30)';
var ACOLOR='rgb(60, 64, 58)';
var MCOLOR='rgb(6, 106, 236)';


var aisTestData=new AisData({
        getProperties: function(){
            return{ NM:NM}
        }
    },
    {
        registerValueProvider: function(){}
    },
    true);
var store=new Store();
var keys={
    items: 'items',
    mouse: 'mouse',
    ship: 'ship'
};

store.storeData(keys.items,[]);

var addItem=function(opt_after,opt_data){
    var id=0;
    var i=0;
    var items=store.getData(keys.items);
    for (i=0;i<items.length;i++){
        if (items[i]=="ship") continue;
        if(items[i]>id) id=items[i];
    }
    id++;
    if (! opt_after) items.push(id);
    else{
        var found=false;
        for (i=0;i<items.length;i++){
            if(items[i] == opt_after){
                if (i < (items.length -1)) {
                    items.splice(i+1, 0, id);
                    found = true;
                    break;
                }
            }
        }
        if (! found)items.push(id);
    }
    if (opt_data) saveData(id,opt_data);
    store.storeData(keys.items,items);
};
var removeItem=function(id){
    var items=store.getData(keys.items);
    for (var i=0;i<items.length;i++){
        if (items[i] == id){
            items.splice(i,1);
            saveData(id,undefined);
            store.storeData(keys.items,items);
            return;
        }
    }
};

var loadAll=function(){
    var currentData=getData();
    if (currentData.ship){
        store.storeData(keys.ship,currentData.ship);
    }
    var items=[];
    for (var idx in currentData){
        if (idx == "ship") continue;
        items.push(idx);
    }
    store.storeData(keys.items,items);
};

var getData=function(){
    var currentString=window.localStorage.getItem("aistest");
    if (! currentString) return {};
    return JSON.parse(currentString);
};
var saveData=function(idx,data){
    var current=getData();
    if (data)  current[idx]=data;
    else delete current[idx];
    window.localStorage.setItem("aistest",JSON.stringify(current));
};
var saveShipPos=function(ship){
    var current=getData();
    current.ship=ship;
    window.localStorage.setItem("aistest",JSON.stringify(current));
};
var Main=React.createClass({
    getInitialState: function(){
        return({
            ship: {lat:"0",lon:"0",factor:"1"}
        });
    },
    render: function(){
        return(
            <div className="main">
                <h1>AIS Test</h1>
                <div className="topButtons">
                    <button className="loadButton" onClick={loadAll}>Load All</button>
                    <button className="downloadButton" onClick={this.download}>Download</button>
                    <a id="download" style={{display:"none"}}/>
                    <button className="uploadButton" onClick={this.upload}>Upload</button>
                    <input id="upload" type="file" style={{display:"none"}} ref="upload" onChange={this.uploadFiles}/>
                </div>
                <div className="shipPos">
                    <label>Ship Lat</label><input type="text" value={this.state.ship.lat} onChange={this.latChanged}/>
                    <label>Ship Lon</label><input type="text" value={this.state.ship.lon} onChange={this.lonChanged}/>
                    <label>Len Factor</label><input type="text" value={this.state.ship.factor} onChange={this.facChanged}/>
                </div>
                <List/>
                <button className="addButton" onClick={addItem}>Add</button>
            </div>

        );
    },
    latChanged:function(ev){
        var v=ev.target.value;
        this.changeShip({lat:v});
    },
    lonChanged:function(ev){
        var v=ev.target.value;
        this.changeShip({lon:v});
    },
    facChanged:function(ev){
        var v=ev.target.value;
        this.changeShip({factor:v});
    },
    changeShip:function(val){
        var nship=avnav.assign({},this.state.ship,val);
        saveShipPos(nship);
        store.storeData(keys.ship,nship);
    },
    componentDidMount: function () {
        store.register(this, keys.ship)
    },
    componentWillUnmount: function () {
        store.deregister(this);
    },
    dataChanged: function () {
        var ship = store.getData(keys.ship||{lat:0,lon:0, factor:1});
        if (!ship.factor) ship.factor=1;
        this.setState({ship: ship});
    },
    download: function () {
        var contentType = 'application/octet-stream';
        var a = document.getElementById('download');
        var blob = new Blob([JSON.stringify(getData(),undefined,2)], {'type': contentType});
        a.href = window.URL.createObjectURL(blob);
        a.download = "aistest.json";
        a.click();
    },
    upload: function(){
        var fi=this.refs.upload;
        if (! fi) return;
        fi.value="";
        fi.click();
    },
    uploadFiles: function(ev){
        if (ev.target.files.length < 1) return;
        var reader=new FileReader();
        reader.onload=function(){
            window.localStorage.setItem("aistest",this.result);
            loadAll();
        };
        reader.readAsText(ev.target.files[0]);
    }
});

var List=React.createClass({
    getInitialState: function(){
        return {list:store.getData(keys.items)};
    },
    componentDidMount: function(){
        store.register(this,keys.items)
    },
    componentWillUnmount: function(){
        store.deregister(this);
    },
    dataChanged:function() {
        var items=store.getData(keys.items);
        this.setState({list:items});
    },
    render: function(){
        if (this.state.list.length == 0) return null;
        return(
            <div className="list">
                {this.state.list.map(function(element){
                    return <SingleItem key={element} id={element} removeHandler={removeItem}/>
                })}
            </div>
        )
    }
});

var Ship=React.createClass({
    propTypes:{
        valueChanged: React.PropTypes.func,
        x: React.PropTypes.any,
        y: React.PropTypes.any,
        course: React.PropTypes.any,
        speed: React.PropTypes.any,
        color: React.PropTypes.string,
        info: React.PropTypes.string
    },
    getInitialState: function(){
        return{
            x:this.props.x||0,
            y:this.props.y||0,
            course:this.props.course||0,
            speed: this.props.speed||0
        }
    },
    render: function(){
        return(
            <div className="ship">
                <div>X:<span className="shipColor" style={{backgroundColor:this.props.color}}/><span className="shipInfo">{this.props.info}</span></div>
                <input type="text" className="xValue" value={this.state.x} onChange={this.setX}/>
                Y:<input type="text" className="yValue" value={this.state.y} onChange={this.setY}/>
                Course:<input type="text" className="courseValue" value={this.state.course} onChange={this.setCourse}/>
                Speed:<input type="text" className="speedValue" value={this.state.speed} onChange={this.setSpeed}/>
            </div>
        );
    },
    setValue:function(index,value){
        var old=this.state;
        var nState={};
        nState[index]=value;
        this.setState(nState);
        if (this.props.valueChanged){
            this.props.valueChanged(assign({},old,nState))
        }
    },
    setX:function(ev){
        this.setValue('x',ev.target.value);
    },
    setY:function(ev){
        this.setValue('y',ev.target.value);
    },
    setCourse:function(ev){
        this.setValue('course',ev.target.value);
    },
    setSpeed: function(ev){
        this.setValue('speed',ev.target.value);
    },
    componentWillMount:function(){
        if (this.props.valueChanged){
            this.props.valueChanged(this.state);
        }
    }

});

var Drawer=function(ctx,width,height){
    /**
     * @type {CanvasRenderingContext2D}
     */
    this.ctx=ctx;
    this.height=height;
    this.width=width;
    this.max=Math.max(this.width,this.height)*1.5;

};

Drawer.prototype.clear=function(){
    this.ctx.clearRect(0,0,this.width,this.height);
};
Drawer.prototype.drawShip=function(ship,color){
    var ctx=this.ctx;
    ctx.fillStyle = color;
    ctx.strokeStyle=color;
    ctx.save();
    ctx.translate(ship.x,ship.y);
    ctx.beginPath();
    ctx.arc(0,0,5,0,2*Math.PI);
    ctx.fill();
    ctx.closePath();
    ctx.rotate((ship.course-90)/180*Math.PI);
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(this.max,0);
    ctx.lineTo(-this.max,0);
    ctx.moveTo(30,0);
    ctx.lineTo(25,5);
    ctx.moveTo(30,0);
    ctx.lineTo(25,-5);
    ctx.stroke();
    ctx.restore();
};
Drawer.prototype.drawPointAtOffset=function(ship,offset,color){
    var ctx=this.ctx;
    ctx.fillStyle = color;
    ctx.strokeStyle=color;
    ctx.save();
    ctx.translate(ship.x,ship.y);
    ctx.rotate((ship.course-90)/180*Math.PI);
    ctx.beginPath();
    ctx.arc(offset,0,5,0,2*Math.PI);
    ctx.fill();
    ctx.closePath();
    ctx.restore();
};
Drawer.prototype.drawPoint=function(xy,color){
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(xy.x,xy.y,5,0,2*Math.PI);
    this.ctx.fill();
    this.ctx.closePath();
};
/**
 * we have our coordinate system rotated by 90° and y inverted
 * so tan(90°-a)=-dy/dx -> cot(a)=-dy/dx or tan(a)=-dx/dy
 * @param X
 * @param Y
 */
var getCourseXY=function(X,Y){
    var dx=Y.x-X.x;
    var dy=Y.y-X.y;
    if (dx == 0 && dy == 0) return 0;
    if (dx == 0 ){
        return (dy > 0)?180:0;
    }
    var courseRad=Math.atan2(-dx,dy);
    if (dx > 0) {
        //courses from 0...180
        if (courseRad < 0) courseRad = Math.PI + courseRad;
    }
    else{
        //dx < 0, courses from 180...360
        if (courseRad < 0) courseRad=Math.PI*2+courseRad;
        else courseRad=Math.PI+courseRad;
    }
    var courseTarget=courseRad*180/Math.PI;
    return courseTarget;
};

var getDistanceXY=function(X,Y) {
    var dx = Y.x - X.x;
    var dy = Y.y - X.y;
    var curdistance = Math.sqrt(dy * dy + dx * dx);
    return curdistance;
};

var MousePositionHandler=React.createClass({
    propTypes:{
        index: React.PropTypes.number.isRequired
    },
    getInitialState:function(){
        return store.getData(keys.mouse+this.props.index,{});
    },
    componentDidMount:function(){
        store.register(this,keys.mouse+this.props.index);
    },
    componentWillUnmount:function(){
        store.deregister(this);
    },
    dataChanged:function(){
        this.setState(store.getData(keys.mouse+this.props.index));
    },
    render: function(){
        var dx=(this.state.x||0) - (this.state.clickX||0);
        var dy=(this.state.y||0) - (this.state.clickY||0);
        var dist=Math.sqrt(dx*dx+dy*dy);
        return(
            <div className="mouse">
                <span>PX={this.state.clickX}</span>
                <span>PY={this.state.clickY}</span>
                <span>X={this.state.x}</span>
                <span>Y={this.state.y}</span>
                <span>D={formatter.formatDecimal(dist,4,2)}</span>
            </div>
        );
    }

});

var SingleItem=React.createClass({
    propTypes:{
        id: React.PropTypes.number.isRequired,
        removeHandler: React.PropTypes.func
    },
    getInitialState: function(){
        var saved=getData()[this.props.id];
        if (saved) {
            this.values = saved;
            //we do not handle any state but load initially...
        }
        else{
            this.values={
                0: {
                    x:10,
                    y:20,
                    course: 90,
                    speed: 1
                },
                1:{
                    x:30,
                    y:40,
                    course:60,
                    speed: 2
                },
                comment:''
            }
        }
        return {comment: this.values.comment};
    },
    render:function(){
        this.drawer=undefined;
        this.mouseDrawer=undefined;
        var state=this.state.approach||{};
        var result=this.state.simulatedResult||{cpa:{},ship:{},target:{}};
        var self=this;
        var X=this.getValues(0);
        var Y=this.getValues(1);
        var aisFormatter=aisTestData.aisparam;
        return(
            <div className="item">
                <div className="canvasFrame">
                <canvas width="250" height="250" className="itemCanvas" ref="canvas" />
                <canvas width="250" height="250" className="mouseCanvas" onClick={this.canvasClick} onMouseMove={this.canvasMove}/>
                </div>
                <div className="itemData" >
                    <div className="info">
                        <div>Scenario#{this.props.id}</div>
                        <input type="text" onChange={this.commentChange} value={this.values.comment} style={(this.values.comment && this.values.comment.match(/!/))?{color:"red"}:{}}/>
                    </div>
                    <div className="ships">
                        <Ship key="x" className="shipX" valueChanged={function(val){self.valueChanged(0,val);}} {...X} color={XCOLOR} info="S">
                        </Ship>
                        <Ship key="y" className="shipY" valueChanged={function(val){self.valueChanged(1,val);}} {...Y} color={YCOLOR}  info="D">
                        </Ship>
                    </div>
                    <div className="results">
                        <span className="courseTarget">cTarget={formatter.formatDecimal(state.courseTarget,4,2)}</span>
                        <span className="distTarget">dTarget={formatter.formatDecimal(state.curdistance,4,2)}</span>
                        <span className="ts">ts={formatter.formatDecimal(state.ts,4,2)}</span>
                        <span className="ds">ds={formatter.formatDecimal(state.ds,4,2)}</span>
                        <span className="td">td={formatter.formatDecimal(state.td,4,2)}</span>
                        <span className="dd">dd={formatter.formatDecimal(state.dd,4,2)}</span>
                        <span className="tm">tm={formatter.formatDecimal(state.tm,4,2)}</span>
                        <span className="dms">dms={formatter.formatDecimal(state.dms,4,2)}</span>
                        <span className="dmd">dmd={formatter.formatDecimal(state.dmd,4,2)}</span>
                    </div>
                    <div className="results">
                        <span>S Pos={formatter.formatLonLats(result.ship)}</span>
                        <span>,{formatter.formatDecimal(result.ship.speed,4,2)} kn</span>
                        <span>D Pos={formatter.formatLonLats(result.target)}</span>
                        <span>,{formatter.formatDecimal(result.target.speed,4,2)} kn</span>
                        <span>Cur={formatter.formatDecimal(result.cpa.curdistance/NM,4,3)} nm</span>
                        <span>,{formatter.formatDecimal(result.cpa.curdistance,4,2)} m</span>
                        <span>Cpa={formatter.formatDecimal(result.cpa.cpanm,4,3)} nm</span>
                        <span>Tcpa(h)={aisFormatter.tcpa.format(result.cpa)}</span>
                        <span>Front={aisFormatter.passFront.format(avnav.assign({},result.cpa,{passFront:result.cpa.front}))}</span>
                        <span>, {result.cpa.front}</span>
                    </div>
                    <MousePositionHandler index={this.props.id}/>
                </div>
                <div className="buttons">
                    <button className="drawButton" onClick={this.drawFunction}>draw</button>
                    <button className="saveButton" onClick={this.saveValues}>save</button>
                    <button className="copyButton" onClick={this.copy}>copy</button>
                    <button className="removeButton" onClick={this.removeFunction}>Remove</button>
                </div>
            </div>
        );
    },
    commentChange: function(ev){
        this.saveValues();
        var nval=ev.target.value;
        this.values.comment=nval;
        this.setState({comment: nval});
    },
    valueChanged:function(idx,newVal){
        if (! this.values){
            this.values={};
        }
        this.values[idx]=newVal;
    },
    removeFunction:function(){
        if (this.props.removeHandler){
            this.props.removeHandler(this.props.id);
        }
    },
    saveValues:function(){
        saveData(this.props.id,this.values);
    },
    getDrawer: function(){
        if (!this.refs.canvas) return;
        if (! this.drawer) {
            //alert("draw");
            var cdom = ReactDOM.findDOMNode(this.refs.canvas);
            if (!cdom) {
                alert("canvas not found");
                return;
            }
            var width = cdom.width;
            var height = cdom.height;
            var ctx = cdom.getContext('2d');
            if (!ctx) {
                alert("no context");
                return;
            }
            this.drawer = new Drawer(ctx, width, height);
        }
        return this.drawer;
    },
    getMouseDrawer: function(element){
        if (! this.mouseDrawer) {
            //alert("draw");
            var cdom = ReactDOM.findDOMNode(element);
            if (!cdom) {
                alert("canvas not found");
                return;
            }
            var width = cdom.width;
            var height = cdom.height;
            var ctx = cdom.getContext('2d');
            if (!ctx) {
                alert("no context");
                return;
            }
            this.mouseDrawer = new Drawer(ctx, width, height);
        }
        return this.mouseDrawer;
    },
    drawFunction: function(){
        this.saveValues();
        if (!this.refs.canvas) return;
        var drawer=this.getDrawer();
        drawer.clear();
        var X=this.getValues(0);
        drawer.drawShip(X,XCOLOR);
        var Y=this.getValues(1);
        drawer.drawShip(Y,YCOLOR);
        var courseTarget=getCourseXY(X,Y);
        var curdistance=getDistanceXY(X,Y);
        var approach=NavCompute.computeApproach(courseTarget,curdistance,X.course,X.speed,Y.course,Y.speed,0.01);
        approach.curdistance=curdistance;
        approach.courseTarget=courseTarget;
        if (approach.ds !== undefined) drawer.drawPointAtOffset(X,approach.ds,XCOLOR);
        if (approach.dms !== undefined) drawer.drawPointAtOffset(X,approach.dms,ACOLOR);
        if (approach.dd !== undefined) drawer.drawPointAtOffset(Y,approach.dd,YCOLOR);
        if (approach.dmd !== undefined) drawer.drawPointAtOffset(Y,approach.dmd,ACOLOR);
        //now compute some pseudo position for the target and use the final ais computation again
        var shipPos=store.getData(keys.ship,{lat:0,lon:0,factor:1});
        var lat=Geo.parseDMS(shipPos.lat);
        var lon=Geo.parseDMS(shipPos.lon.replace(/o/i, 'e'));
        var factor=parseFloat(shipPos.factor);
        var simulatedShip=new NavObjects.GpsInfo();
        simulatedShip.speed=X.speed/speedKnToMs; //is in kn
        simulatedShip.lat=lat;
        simulatedShip.lon=lon;
        simulatedShip.course=X.course;
        var simulatedResult={};
        simulatedResult.ship=simulatedShip;
        var aisTarget=NavCompute.computeTarget(simulatedShip,courseTarget,factor*curdistance);
        simulatedResult.target=avnav.assign({},aisTarget,{course:Y.course,speed:Y.speed/speedKnToMs,mmsi: this.props.id});
        simulatedResult.cpa=NavCompute.computeCpa(simulatedResult.ship,simulatedResult.target,{NM:NM,minAISspeed:0.2*speedKnToMs})
        console.log("xxx"+lat+","+lon+","+factor);

        this.setState({
            approach:approach,
            simulatedResult: simulatedResult
        });
    },
    getValues:function(index){
        var rt={x:0,y:0,course:0,speed:0};
        if (this.values && this.values[index]){
            rt=this.values[index];
        }
        var newCourse=parseFloat(rt.course);
        if (newCourse < 0) newCourse=0;
        if (newCourse >= 360) newCourse=259.9;
        return{
            x: parseFloat(rt.x),
            y: parseFloat(rt.y),
            course: newCourse,
            speed: parseFloat(rt.speed)
        }
    },
    canvasClick:function(ev){
        var m=store.getData(keys.mouse+this.props.id,{});
        var drawer=this.getMouseDrawer(ev.target);
        var rect=ev.target.getBoundingClientRect();
        var x=ev.clientX-rect.left;
        var y=ev.clientY-rect.top;
        m.clickX=x;
        m.clickY=y;
        m.x=x;
        m.y=y;
        if (drawer) {
            drawer.clear();
            drawer.drawPoint({x:m.clickX,y:m.clickY},MCOLOR);
        }
        store.storeData(keys.mouse+this.props.id,m);
    },
    canvasMove: function(ev){
        var m=store.getData(keys.mouse+this.props.id,{});
        var rect=ev.target.getBoundingClientRect();
        var x=ev.clientX-rect.left;
        var y=ev.clientY-rect.top;
        if (m.x == x && m.y == y) return;
        m.x=x;
        m.y=y;
        store.storeData(keys.mouse+this.props.id,m);
    },
    copy: function(){
        var data=this.values;
        if (! data) return;
        addItem(this.props.id,data);
    },
    componentDidMount: function(){
        window.setTimeout(this.drawFunction,100);
    }


});

window.onload=function(){
    ReactDOM.render(<Main/>,document.getElementById('main'));
};
