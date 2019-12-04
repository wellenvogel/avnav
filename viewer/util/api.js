/**
 * the api definition the can be used by user code
 * will be visible at window.avnav.api
 */

import WidgetFactory from '../components/WidgetFactory.jsx';
import base from '../base.js';
import Formatter from './formatter.js';

class Api{
    constructor(){
        this.formatter=Formatter;
    }

    log(text){
        base.log("API: "+text);
    }
    registerWidget(description){
        WidgetFactory.registerExternalWidget(description);
    }
    formatter(){
        return Formatter;
    }

}

export default new Api();

