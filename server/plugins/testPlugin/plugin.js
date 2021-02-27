console.log("test plugin loaded");
/**
 * a widget, that does not create any HTML by its own but  allows for some own formatting of the
 * displayed data of the default widget
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

avnav.api.registerWidget(simpleWidget);


var widget={
    name:"testPlugin_CourseWidget",
    /**
     * a function that will render the HTML content of the widget
     * normally it should return a div with the class widgetData
     * but basically you are free
     * If you return null, the widget will not be visible any more.
     * @param props
     * @returns {string}
     */
    renderHtml:function(props){
        /**
         * example for storing some instance data
         * in this case a useless counter, that will increment on each update
         * "this" points to the context object that represent the instance of the widget
         * initially it will only contain the eventHandler array and a triggerRedraw function
         * whenever the page will reload it will be emptied again!
         */
        if (this.counter === undefined) this.counter=0;
        this.counter++;
        var dv=avnav.api.formatter.formatDirection(props.course);
        var replacements={
            course: props.course
        };
        var template='<div class="widgetData">${course}</div>';
        return avnav.api.templateReplace(template,replacements);
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
        var ctx=canvas.getContext('2d');
        // Set scale factor for all values
        var crect=canvas.getBoundingClientRect();
        var w=crect.width;
        var h=crect.height;
        canvas.width=w;
        canvas.height=h;
        ctx.save();
        var width = 200;			// Control width
        var height = 200;			// Control height
        var f1=w/width;
        var f2=h/height;
        var f=Math.min(f1,f2);
        ctx.scale(f,f);
        ctx.translate(100*f1/f,100*f2/f); //move the drawing to the middle
        // Rotate
        ctx.rotate(props.course * Math.PI / 180);
        // Write pointer
        ctx.beginPath();
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000000';
        var pointer_length=80;
        ctx.moveTo(0,0);
        ctx.lineTo(0,-pointer_length);
        ctx.stroke();
        ctx.lineTo(12,-pointer_length+12);
        ctx.lineTo(-12,-pointer_length+12);
        ctx.lineTo(0,-pointer_length);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    },
    /**
     * the access to the internal store
     * this should be an object where the keys are the names you would like to
     * see as properties when your render functions are called
     * whenever one of the values in the store is changing, your render functions will be called
     */
    storeKeys:{
      course: 'nav.gps.course',
      myValue: 'nav.gps.test' //stored at the server side with gps.test

    },
    caption: "Test(Course)",
    unit: "°"
};
avnav.api.registerWidget(widget);

/**
 * a widget that demonstrates how a widget from a plugin can interact with the python part
 * the widget will display the number of received nmea records
 * with a reset button the counter in the plugin at the python side can be reset
 *
 */
var widgetServer={
    name:"testPlugin_ServerWidget",
    /**
     * if our plugin would like to use event handlers (like button click)
     * we need to register handler functions
     * this can be done at any time - but for performance reasons this should be done
     * inside an init function
     * @param context - the context - this is an object being the "this" for all other function calls
     *                  there is an empty eventHandler object in this context.
     *                  we need to register a function for every event handler we would like to use
     *                  later in renderHtml
     */
    initFunction:function(context){
        /**
         * each event handler we register will get the event as parameter
         * when being called, this is pointing to the context (not the event target - this can be obtained by ev.target)
         * in this example we issue a request to the python side of the plugin using the
         * global variable AVNAV_BASE_URL+"/api" and appending a further url
         * We expect the response to be json
         * @param ev
         */
        context.eventHandler.buttonClick=function(ev){
            //when the event handle ris called, this points to the context
            var self=this;
            var id=(new Date()).getTime();
            //we remember this request as the currently last request being run
            //we could also prevent a new request if we want
            self.requestRunning=id;
            //as we add a differnt class to our display (color...) when a request is running
            //we must redraw now
            self.triggerRedraw();
            fetch(AVNAV_BASE_URL+"/api/reset")
                .then(function(data){
                    return data.json();
                })
                .then(function(json)
                {
                    if (self.requestRunning==id) {
                        //if this is the answer to the last running request - switch of
                        //the request running - and redraw
                        self.requestRunning=undefined;
                        self.triggerRedraw();
                    }
                    //alert("STATUS:"+json.status);
                })
                .catch(function(error){
                    if (self.requestRunning==id) {
                        //if this is the answer to the last running request - switch of
                        //the request running - and redraw
                        self.requestRunning=undefined;
                        self.triggerRedraw();
                    }
                    avnav.api.showToast("ERROR: "+error)}
            );
        };
        context.requestRunning=undefined;
    },
    /**
     * a function that will render the HTML content of the widget
     * normally it should return a div with the class widgetData
     * but basically you are free
     * If you return null, the widget will not be visible any more.
     * @param props
     * @returns {string}
     */
    renderHtml:function(props){
        /**
         * in our html below we assign an event handler to the button
         * just be careful: this is not a strict W3C conforming HTML syntax:
         * the event handler is not directly js code but only the name(!) of the registered event handler.
         * it must be one of the names we have registered at the context.eventHandler in our init function
         * Unknown handlers or pure java script code will be silently ignored!
         */
        var buttonClass="reset";
        //as we are not sure if the browser supports template strings we use the AvNav helper for that...
        var replacements={
            myValue:props.myValue,
            buttonClass: buttonClass,
            disabled: this.requestRunning?"disabled":""
        };
        var template='<div class="widgetData">' +
            '<button class="${buttonClass}" ${disabled}  onclick="buttonClick">Reset</button>' +
            '<div class="server">${myValue}</div></div>';
        return avnav.api.templateReplace(template,replacements);
    },
    /**
     * the access to the internal store
     * this should be an object where the keys are the names you would like to
     * see as properties when your render functions are called
     * whenever one of the values in the store is changing, your render functions will be called
     */
    storeKeys:{
        myValue: 'nav.gps.test' //stored at the server side with gps.test

    },
    caption: "Server Nmea Requests",
    unit: ""
};

avnav.api.registerWidget(widgetServer);
avnav.api.log("testPlugin widgets registered");
