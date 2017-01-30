var React=require('react');
var ReactDOM=require('react-dom');
var assign=require('object-assign');
require('../base.js');
var NavCompute=require('../nav/navcompute');
var Formatter=require('../util/formatter');

var formatter=new Formatter();

var XCOLOR='rgb(206, 46, 46)';
var YCOLOR='rgb(72, 142, 30)';
var ACOLOR='rgb(60, 64, 58)';

var items=[];
var itemHandler=undefined;

function addItem(){
    var id=0;
    for (var i=0;i<items.length;i++){
        if(items[i]>id) id=items[i];
    }
    id++;
    items.push(id);
    if (itemHandler) itemHandler(items);
}
function removeItem(id){
    for (var i=0;i<items.length;i++){
        if (items[i] == id){
            items.splice(i,1);
            if (itemHandler) itemHandler(items);
            return;
        }
    }
}
var Main=React.createClass({
    render: function(){
        return(
            <div className="main">
                <h1>AIS Test</h1>
                <List/>
                <button className="addButton" onClick={addItem}>Add</button>
            </div>

        );
    }
});

var List=React.createClass({
    getInitialState: function(){
        return {list:[]};
    },
    componentWillMount: function(){
        itemHandler=this.listChanged;
    },
    listChanged:function(items) {
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
        color: React.PropTypes.string
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
                <div>X:<span className="shipColor" style={{backgroundColor:this.props.color}}/></div>
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

var SingleItem=React.createClass({
    propTypes:{
        id: React.PropTypes.number.isRequired,
        removeHandler: React.PropTypes.func
    },
    getInitialState: function(){
        var saved=window.localStorage.getItem("aistest"+this.props.id);
        if (saved) {
            this.values = JSON.parse(saved);
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
                }
            }
        }
        return {};
    },
    render:function(){
        var self=this;
        var X=this.getValues(0);
        var Y=this.getValues(1);
        return(
            <div className="item">
                <canvas width="250" height="250" className="itemCanvas" ref="canvas"/>
                <div className="itemData" >
                    <div className="Info">
                        <div>Scenario#{this.props.id}</div>
                    </div>
                    <div className="ships">
                        <Ship key="x" className="shipX" valueChanged={function(val){self.valueChanged(0,val);}} {...X} color={XCOLOR}>
                        </Ship>
                        <Ship key="y" className="shipY" valueChanged={function(val){self.valueChanged(1,val);}} {...Y} color={YCOLOR}  >
                        </Ship>
                    </div>
                    <div className="results">
                        <span className="courseTarget">cTarget={formatter.formatDecimal(this.state.courseTarget,4,2)}</span>
                        <span className="distTarget">dTarget={formatter.formatDecimal(this.state.curdistance,4,2)}</span>
                        <span className="ts">ts={formatter.formatDecimal(this.state.ts,4,2)}</span>
                        <span className="ds">ds={formatter.formatDecimal(this.state.ds,4,2)}</span>
                        <span className="td">td={formatter.formatDecimal(this.state.td,4,2)}</span>
                        <span className="dd">dd={formatter.formatDecimal(this.state.dd,4,2)}</span>
                        <span className="tm">tm={formatter.formatDecimal(this.state.tm,4,2)}</span>
                        <span className="dms">dms={formatter.formatDecimal(this.state.dms,4,2)}</span>
                        <span className="dmd">dmd={formatter.formatDecimal(this.state.dmd,4,2)}</span>
                    </div>
                </div>
                <div className="buttons">
                    <button className="drawButton" onClick={this.drawFunction}>draw</button>
                    <button className="saveButton" onClick={this.saveValues}>save</button>
                    <button className="removeButton" onClick={this.removeFunction}>Remove</button>
                </div>
            </div>
        );
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
        window.localStorage.setItem("aistest"+this.props.id,JSON.stringify(this.values))
    },
    drawFunction: function(){
        if (!this.refs.canvas) return;
        //alert("draw");
        var cdom=ReactDOM.findDOMNode(this.refs.canvas);
        if (! cdom){
            alert("canvas not found");
        }
        var width=cdom.width;
        var height=cdom.height;
        var ctx=cdom.getContext('2d');
        if (! ctx) {
            alert("no context");
            return;
        }
        var drawer=new Drawer(ctx,width,height);
        drawer.clear();
        var X=this.getValues(0);
        drawer.drawShip(X,XCOLOR);
        var Y=this.getValues(1);
        drawer.drawShip(Y,YCOLOR);
        var dx=Y.x-X.x;
        var dy=Y.y-X.y;
        var courseTarget=180-Math.atan(dy/dx)*180/Math.PI+90; //we have our system rotated by 90 (i.e. east is 0)
        var curdistance=Math.sqrt(dy*dy+dx*dx);
        var approach=NavCompute.computeApproach(courseTarget,curdistance,X.course,X.speed,Y.course,Y.speed,0.01);
        approach.curdistance=curdistance;
        approach.courseTarget=courseTarget;
        if (approach.ds !== undefined) drawer.drawPointAtOffset(X,approach.ds,XCOLOR);
        if (approach.dms !== undefined) drawer.drawPointAtOffset(X,approach.dms,ACOLOR);
        if (approach.dd !== undefined) drawer.drawPointAtOffset(Y,approach.dd,YCOLOR);
        if (approach.dmd !== undefined) drawer.drawPointAtOffset(Y,approach.dmd,ACOLOR);
        this.setState(approach);
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
    }

});

window.onload=function(){
    ReactDOM.render(<Main/>,document.getElementById('main'));
};
