console.log("test plugin loaded");

var widget={
    name:"testPlugin.Widget",
    renderHtml:function(props){
        var dv=avnav.api.formatter.formatDirection(props.value);
        return "<div class=\"widgetData\">Course: "+dv+"</div>";
    },
    renderCanvas:function(canvas,props){
        let ctx=canvas.getContext('2d');
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
        ctx.scale(f,f);
        ctx.translate(100*f1/f,100*f2/f); //move the drawing to the middle
        // Rotate
        ctx.rotate(props.value * Math.PI / 180);
        // Write pointer
        ctx.beginPath();
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000000';
        let pointer_length=80;
        ctx.moveTo(0,0);
        ctx.lineTo(0,-pointer_length);
        ctx.stroke();
        ctx.lineTo(12,-pointer_length+12);
        ctx.lineTo(-12,-pointer_length+12);
        ctx.lineTo(0,-pointer_length);
        ctx.fill();
        ctx.stroke();
    },
    storeKeys:{
      value: 'nav.gps.course'
    },
    caption: "Test",
    unit: "°"
};
avnav.api.registerWidget(widget);
avnav.api.log("testPlugin.Widget registered");
