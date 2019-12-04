console.log("test plugin loaded");

var widget={
    name:"testPlugin_Widget",
    /**
     * a function that will render the HTML content of the widget
     * normally it should return a div with the class widgetData
     * but basically you are free
     * It is important to return one surrounding element (not a list of multiple).
     * You can nest internally as much as you want.
     * If you return null, the widget will not be visible any more.
     * @param props
     * @returns {string}
     */
    renderHtml:function(props){
        /**
         * example for storing some instance data
         * in this case a useless counter, that will increment on each update
         * "this" points to an object that represent the instance of the widget
         * initially it will be empty
         * whenever the page will reload it will be emptied again!
         */
        if (this.counter === undefined) this.counter=0;
        this.counter++;
        var dv=avnav.api.formatter.formatDirection(props.myValue);
        return "<div class=\"widgetData\">["+this.counter+"] "+dv+"</div>";
    },
    /**
     * optional render some graphics to a canvas object
     * you should style the canvas dimensions in the plugin.css
     * be sure to potentially resize and empty the canvas before drawing
     * @param canvas
     * @param props - the properties you have provided here + the properties you
     *                defined with the storeKeys
     */
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
        ctx.rotate(props.myValue * Math.PI / 180);
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
    /**
     * the access to the internal store
     * this should be an object where the keys are the names you would like to
     * see as properties when your render functions are called
     * whenever one of the values in the store is changing, your render functions will be called
     */
    storeKeys:{
      myValue: 'nav.gps.course'
    },
    caption: "Test",
    unit: "°"
};

/**
 * a widget, that simply allows for some own formatting of the displayed data
 * basically you can set the caption, the unit and the formatter for the data
 * additionally you can style your widget in css
 */
var simpleWidget={
    /**
     * mandatory - should be a name that can be used as a css class
     *             to avoid collisions you should prefix the name with the name of
     *             your plugin
     *             when you try to register an existing name an Error will be thrown
     */
    name:"testPlugin_SimpleWidget",
    /**
     * access to the store - see above
     * for using the default widget it is necessary to have a key named "value"
     * as this is the property that will be used by the default widget
     */
    storeKeys:{
        value: 'nav.gps.course'
    },
    caption: "Test",
    unit: "°",
    /**
     * mandatory for the default widget
     * can be one of the available formatter functions or your own
     * it is important that you will always format with leading spaces (or zeros)
     * otherwise the scaling on the gpspage will potentially not work correctly
     */
    formatter:avnav.api.formatter.formatDirection
};
avnav.api.registerWidget(widget);
avnav.api.registerWidget(simpleWidget);
avnav.api.log("testPlugin widgets registered");
