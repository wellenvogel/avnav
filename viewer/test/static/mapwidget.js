(function() {


    let MapWidget={
        type: 'map',
        name: 'maptest',
        renderCanvas: function(canvas,context){
            let renderContext=this.getContext();
            let pos={"lon": 13.4069155457948, "lat": 52.512923881489115};
            renderContext.save();
            let center=this.lonLatToPixel(pos.lon,pos.lat);
            renderContext.translate(center[0],center[1]);
            renderContext.lineWidth=5;
            renderContext.strokeStyle="red";
            renderContext.beginPath();
            renderContext.arc(0,0,50,0,2*Math.PI);
            renderContext.stroke();
            renderContext.restore();
        }
    };
    avnav.api.registerWidget(MapWidget);
}());