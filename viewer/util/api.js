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
    registerWidget(description,opt_editableParameters){
        WidgetFactory.registerWidget(description,opt_editableParameters);
    }
    formatter(){
        return Formatter;
    }

}

export default new Api();

