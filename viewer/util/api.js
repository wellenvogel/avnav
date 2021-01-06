/**
 * the api definition the can be used by user code
 * will be visible at window.avnav.api
 */

import WidgetFactory from '../components/WidgetFactory.jsx';
import base from '../base.js';
import Formatter from './formatter.js';
import Helper from './helper.js';
import Toast from '../components/Toast.jsx';

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
    /**
     * replace any ${name} with the values of the replacement object
     * e.g. templateReplace("test${a} test${zzz}",{a:"Hello",zzz:"World"})
     * will return: "testHello testWorld"
     * @param tstring
     * @param replacements
     * @returns {string}
     */
    templateReplace(template,replacements){
        return Helper.templateReplace(template,replacements)
    }

    /**
     * escape special characters in a string
     * so it can be afterwards safely added to some HTML
     * @param string
     */
    escapeHtml(string){
        return Helper.escapeHtml(string);
    }

    /**
     * show a toast containing a message
     * @param string the message
     * @param opt_time a timeout in ms (optional)
     */
    showToast(string,opt_time){
        Toast(string,opt_time);
    }

    /**
     * register a formatter function
     * if the formatter (name) already exists an exception is thrown
     * the formatterFunction should have a "parameters" property describing the meaning
     * of it's (potentially) handled options
     * @param name the name of the formatter
     * @param formatterFunction the function
     */
    registerFormatter(name,formatterFunction){
        WidgetFactory.registerFormatter(name,formatterFunction);
    }

}

export default  new Api();

