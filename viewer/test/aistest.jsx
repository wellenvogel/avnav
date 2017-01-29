var React=require('react');
var ReactDOM=require('react-dom');
var assign=require('object-assign');
require('../base.js');
var NavCompute=require('../nav/navcompute');

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
        course: React.PropTypes.any
    },
    getInitialState: function(){
        return{
            x:this.props.x||0,
            y:this.props.y||0,
            course:this.props.course||0
        }
    },
    render: function(){
        return(
            <div className="ship">
                X:<input type="text" className="xValue" value={this.state.x} onChange={this.setX}/>
                Y:<input type="text" className="yValue" value={this.state.y} onChange={this.setY}/>
                Course:<input type="text" className="courseValue" value={this.state.course} onChange={this.setCourse}/>
            </div>
        );
    },
    setX:function(ev){
        var old=this.state;
        var newX=ev.target.value;
        this.setState({x:newX});
        if (this.props.valueChanged){
            this.props.valueChanged(assign({},old,{x:newX}))
        }
    },
    setY:function(ev){
        var old=this.state;
        var newY=ev.target.value;
        this.setState({y:newY});
        if (this.props.valueChanged){
            this.props.valueChanged(assign({},old,{y:newY}))
        }
    },
    setCourse:function(ev){
        var old=this.state;
        var newCourse=ev.target.value;
        this.setState({course:newCourse});
        if (this.props.valueChanged){
            this.props.valueChanged(assign({},old,{course:newCourse}))
        }
    },
    componentWillMount:function(){
        if (this.props.valueChanged){
            this.props.valueChanged(this.state);
        }
    }

});

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
                    course: 90
                },
                1:{
                    x:30,
                    y:40,
                    course:60
                }
            }
        }
        return null;
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
                        <Ship key="x" className="shipX" valueChanged={function(val){self.valueChanged(0,val);}} x={X.x}
                              y={X.y} course={X.course}>
                        </Ship>
                        <Ship key="y" className="shipY" valueChanged={function(val){self.valueChanged(1,val);}} x={Y.x}
                              y={Y.y} course={Y.course}>
                        </Ship>
                    </div>
                    <div className="results">
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
        var ctx=cdom.getContext('2d');
        if (! ctx) {
            alert("no context");
            return;
        }
        ctx.clearRect(0,0,cdom.width,cdom.height);
        var X=this.getValues(0);
        ctx.fillStyle = 'rgb(206, 46, 46)';
        ctx.beginPath();
        ctx.arc(X.x,X.y,5,0,2*Math.PI);
        ctx.fill();
        ctx.closePath();
        var Y=this.getValues(1);
        ctx.fillStyle = 'rgb(72, 142, 30)';
        ctx.beginPath();
        ctx.arc(Y.x,Y.y,5,0,2*Math.PI);
        ctx.fill();
        ctx.closePath();
    },
    getValues:function(index){
        var rt={x:0,y:0,course:0};
        if (this.values && this.values[index]){
            rt=this.values[index];
        }
        var newCourse=parseFloat(rt.course);
        if (newCourse < 0) newCourse=0;
        if (newCourse >= 360) newCourse=259.9;
        return{
            x: parseFloat(rt.x),
            y: parseFloat(rt.y),
            course: newCourse
        }
    }

});

window.onload=function(){
    ReactDOM.render(<Main/>,document.getElementById('main'));
};
