/**
 * Created by andreas on 23.02.16.
 */

let React=require("react");
let Store=require('../util/storeapi');
let Formatter=require('../util/formatter');

let WindGraphics=React.createClass({
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
        let classes = "avn_widget avn_WindGraphics " + this.props.classes || ""+ " "+this.props.className||"";
        let style = this.props.style || {};
        setTimeout(self.drawWind,0);
        let formatter=new Formatter();
        let windSpeed="";
        let showKnots=this.props.propertyHandler.getProperties().windKnots;
        try{
            windSpeed=parseFloat(this.props.store.getData('windSpeed'));
            if (showKnots){
                let nm=this.props.propertyHandler.getProperties().NM;
                windSpeed=windSpeed*3600/nm;
            }
            if (windSpeed < 10) windSpeed=formatter.formatDecimal(windSpeed,1,2);
            else windSpeed=formatter.formatDecimal(windSpeed,3,0);
        }catch(e){}
        return (
            <div className={classes} onClick={this.props.onClick} style={style}>
                <canvas className='avn_widgetData' ref={self.canvasRef}></canvas>
                <div className='avn_widgetInfoLeft'>Wind</div>
                <div className='avn_widgetInfoRight'>{showKnots?"kn":"m/s"}</div>
                <div className="avn_windSpeed">{windSpeed}</div>
            </div>

        );

    },
    click:function(){
        this.props.onItemClick(avnav.assign({},this.props,this.state));
    },
    canvasRef:function(item){
        let self=this;
        this.canvas=item;
        console.log("canvas ref");
        setTimeout(self.drawWind,0);
    },
    drawWind:function(){
        let canvas=this.canvas;
        if (! canvas) return;
        let ctx=canvas.getContext('2d');
        let formatter=new Formatter();
        // Set scale factor for all values
        let crect=canvas.getBoundingClientRect();
        let w=crect.width;
        let h=crect.height;
        canvas.width=w;
        canvas.height=h;
        let width = 200;			// Control width
        let height = 200;			// Control height
        let f1=w/width;
        let f2=h/height;
        let f=Math.min(f1,f2);
        let fontSize=f*height/5;
        let mvx=(w-width*f)/2;
        let mvy=(h-height*f)/2;
        ctx.translate(mvx>0?0.9*mvx:0,mvy>0?mvy:0); //move the drawing to the middle
        ctx.scale(f,f);


        // Settings
        let radius = 100;			// Radius of control
        let pointer_lenght = 80;	// Pointer lenght
        let pointer_linewidth = 6;	// Pointer lenght
        let circle_linewidth = 1;	// Pointer lenght
        let value_min = 0;			// Minimum of value
        let value_max = 360;		// Maximum of value
        let angle_scala = 360;		// Angle of scala
        let angle_offset = 0;		// Angle offset for scala, Center 0° is north

        // Create random value for wind direction and wind speed
        let winddirection = parseFloat(this.props.store.getData('windAngle'));
        let windspeed = parseFloat(this.props.store.getData('windSpeed'));

        // Calculation of pointer rotation
        let angle = ((angle_scala) / (value_max - value_min) * winddirection) + angle_offset;

        // Write inner circle in center position
        ctx.beginPath();
        ctx.lineWidth = circle_linewidth;
        ctx.arc(width / 2 ,height / 2,radius*0.8,0,2*Math.PI);
        ctx.stroke();
        // Write left partial circle
        ctx.beginPath();
        ctx.strokeStyle = '#888888'; // gray
        ctx.lineWidth = 10;
        let start = 210;
        let end = 250;
        ctx.arc(width / 2 ,height / 2,radius*0.9,2*Math.PI/360*start,2*Math.PI/360*end);
        ctx.stroke();
        // Write right partial circle
        ctx.beginPath();
        ctx.strokeStyle = '#888888'; // gray
        ctx.lineWidth = 10;
        start = 290;
        end = 330;
        ctx.arc(width / 2 ,height / 2,radius*0.9,2*Math.PI/360*start,2*Math.PI/360*end);
        ctx.stroke();
        // Write partial circle
        ctx.beginPath();
        ctx.strokeStyle = '#888888'; // gray
        ctx.lineWidth = 10;
        start = 40;
        end = 140;
        ctx.arc(width / 2 ,height / 2,radius*0.9,2*Math.PI/360*start,2*Math.PI/360*end);
        ctx.stroke();
        // Write scale
        for (let i = 0; i < 12; i++){
            ctx.beginPath();
            ctx.strokeStyle = '#666666'; // dark gray
            ctx.lineWidth = 10;
            start = i*30;
            end = i*30+2;
            ctx.arc(width / 2 ,height / 2,radius*0.9,2*Math.PI/360*start,2*Math.PI/360*end);
            ctx.stroke();
        }
        // Create text
        ctx.font = fontSize+"px Arial";
        ctx.fillText(formatter.formatDecimal(winddirection,3,0) + "°",width/2*0.7,height/2*1.15);
        // Move the pointer from 0,0 to center position
        ctx.translate(width / 2 ,height / 2);
        // Rotate
        ctx.rotate(angle * Math.PI / 180);
        // Write pointer
        ctx.beginPath();
        ctx.lineWidth = pointer_linewidth;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000000';
        ctx.moveTo(0,(-pointer_lenght - (-pointer_lenght / 3)));
        ctx.lineTo(0,-pointer_lenght);
        ctx.stroke();
    }

});

module.exports=WindGraphics;