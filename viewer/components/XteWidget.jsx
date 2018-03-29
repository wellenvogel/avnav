/**
 * Created by andreas on 23.02.16.
 */

let React=require("react");
let Store=require('../util/storeapi');
let Formatter=require('../util/formatter');

let XteWidget=React.createClass({
    propTypes:{
        onItemClick: React.PropTypes.func,
        store: React.PropTypes.instanceOf(Store).isRequired,
        classes: React.PropTypes.string,
        updateCallback: React.PropTypes.func,
        propertyHandler: React.PropTypes.object.isRequired,
    },
    _getValues:function(){
        return{

        };
    },
    getInitialState: function(){
        return this._getValues();

    },
    componentWillReceiveProps: function(nextProps) {
        this.setState(this._getValues());
    },
    render: function(){
        let self = this;
        let classes = "avn_widget avn_xteWidget " + this.props.classes || ""+ " "+this.props.className||"";
        let style = this.props.style || {};
        setTimeout(self.drawXte,0);
        return (
            <div className={classes} onClick={this.props.onClick} style={style}>
                <canvas className='avn_widgetData' ref={self.canvasRef}></canvas>
                <div className='avn_widgetInfoLeft'>XTE</div>
                <div className='avn_widgetInfoRight'>nm</div>
            </div>

        );

    },
    click:function(){
        this.props.onItemClick(avnav.assign({},this.props,this.state));
    },
    canvasRef:function(item){
        this.canvas=item;
        console.log("canvas ref");
        setTimeout(self.drawXte,0);
    },
    drawXte:function(){
        let canvas=this.canvas;
        if (! canvas) return;
        let context=canvas.getContext('2d');
        let formatter=new Formatter();
        let xteMax=this.props.propertyHandler.getProperties().gpsXteMax;
        let xteText=formatter.formatDecimal(xteMax,1,1);
        let color=canvas.style.color;
        context.fillStyle =color;
        context.strokeStyle=color;
        let crect=canvas.getBoundingClientRect();
        let w=crect.width;
        let h=crect.height;
        canvas.width=w;
        canvas.height=h;
        context.clearRect(0,0,w,h);
        //fix for duplicate canvas in Android 4.x stock browser and webview
        //https://medium.com/@dhashvir/android-4-1-x-stock-browser-canvas-solution-ffcb939af758
        context.canvas.style.visibility ='hidden'; // Force a change in DOM
        context.canvas.offsetHeight; // Cause a repaint to take play
        context.canvas.style.visibility = 'inherit'; // Make visible again
        let textBase=h*0.9;
        let textSize=h*0.2;
        let left=w*0.1;
        let right=w*0.9;
        let linebase=h*0.4;
        let sideHeight=h*0.3;
        let middleHeight=h*0.6;
        let shipUpper=h*0.45;
        let shipH=h*0.3;
        let shipw=w*0.03;
        let mText="0";
        context.font="normal "+Math.ceil(textSize)+"px Arial";
        context.textAlign="center";
        context.fillText(xteText,left,textBase);
        context.fillText(xteText,right,textBase);
        context.fillText("0",0.5*w,textBase);
        context.lineWidth=3;
        context.beginPath();
        context.moveTo(left,linebase-0.5*sideHeight);
        context.lineTo(left,linebase+0.5*sideHeight);
        context.moveTo(left,linebase);
        context.lineTo(right,linebase);
        context.moveTo(right,linebase-0.5*sideHeight);
        context.lineTo(right,linebase+0.5*sideHeight);
        context.moveTo(0.5*w,linebase-0.5*middleHeight);
        context.lineTo(0.5*w,linebase+0.5*middleHeight);
        context.stroke();
        context.closePath();
        let curXte=this.props.store.getData('markerXte');
        if (curXte === undefined) return;
        let xtepos=parseFloat(curXte.replace(/ /,''))/xteMax;
        if (xtepos < -1.1) xtepos=-1.1;
        if (xtepos > 1.1) xtepos=1.1;
        xtepos=xtepos*(right-left)/2+left+(right-left)/2;
        context.beginPath();
        context.moveTo(xtepos,shipUpper);
        context.lineTo(xtepos-shipw,shipUpper+shipH);
        context.lineTo(xtepos+shipw,shipUpper+shipH);
        context.lineTo(xtepos,shipUpper);
        context.fill();
        context.closePath();
    }

});

module.exports=XteWidget;