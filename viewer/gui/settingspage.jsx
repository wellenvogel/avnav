/**
 * Created by Andreas on 01.06.2014.
 */
var Store=require('../util/store');
var React=require('react');
var ReactDOM=require('react-dom');
var ItemUpdater=require('../components/ItemUpdater.jsx');
var ItemList=require("../components/ItemList.jsx");

var keys={
    panelVisibility: 'panelVisibility', //header|items|both
    sectionItems: 'sectionItems',
    activeItems: 'activeItems'
};

var settingsSections={
    Layer: ["layers.ais","layers.track","layers.nav","layers.boat","layers.grid","layers.compass"],
    UpdateTimes: ["positionQueryTimeout","trackQueryTimeout","aisQueryTimeout" ]
};

var sectionSelectors={
    selected: 'avn_selectedItem'
};

/**
 *
 * @constructor
 */
var Settingspage=function(){
    //a collection of all items, key is the name, value a function to get the current value
    this.allItems={};
    /**
     * @private
     * @type {avnav.util.Formatter}
     */
    this.formatter=new avnav.util.Formatter();

    this.store=new Store();

    this.sectionItems=[];

    avnav.gui.Page.call(this,'settingspage');
    this.store.register(this,keys.sectionItems);
};
avnav.inherits(Settingspage,avnav.gui.Page);

/**
 * the local init called from the base class when the page is instantiated
 */
Settingspage.prototype.localInit=function(){
    var self=this;
    this.sectionItems=[];
    var idx=0;
    for (var section in settingsSections){
        this.sectionItems.push({name:section,key:idx,data:settingsSections[section]});
        idx++;
    }
    var SectionItem=function(properties){
        return <div className={properties.addClass+ " avn_list_entry"} onClick={properties.onClick}>{properties.name}</div>
    };
    var SettingsItem=function(properties){
        return <div className={properties.addClass+ " avn_list_entry"} onClick={properties.onClick}>{properties.name}</div>
    };
    var sectionClick=function(item){
        var current=self.store.getData(keys.sectionItems,{}).selectors;
        if (current && current[sectionSelectors.selected] == item.key) return;
        self.store.updateSubItem(keys.sectionItems,sectionSelectors.selected,item.key,'selectors');
    };
    var settingsClick=function(item){
        self.toast(item.name+" clicked");
    };
    var SectionList=ItemUpdater(ItemList,this.store,keys.sectionItems);
    var SettingsList=ItemUpdater(ItemList,this.store,keys.activeItems);
    var Settings=ItemUpdater(React.createClass({
        render: function(){
            var leftVisibile=true;
            var rightVisible=true;
            return (
                <div className="avn_panel_fill">
                    { leftVisibile && <div className="avn_leftSection"><SectionList
                        className="avn_scroll"
                        itemClass={SectionItem}
                        onItemClick={sectionClick}
                        itemList={self.sectionItems}
                                 /></div>}
                    {rightVisible && <div className="avn_rightSection"><SettingsList
                        className="avn_scroll"
                        itemClass={SettingsItem}
                        onItemClick={settingsClick}
                    /></div>}
                </div>
            );
        }
    }),this.store,keys.panelVisibility);
    ReactDOM.render(React.createElement(Settings,{}),this.selectOnPage('.avn_left_inner')[0]);
    $('.avn_setting').each(function(idx,el){
        var name=$(el).attr('avn_name');
        self.createSettingHtml(self.gui.properties.getDescriptionByName(name),el);
    });
    //globally activate the reset handlers
    //they will reset all settings below their parent
    $(this.getDiv()).find('.avn_settings_reset').on('click',function(evt){
        var p=$(this).parent();
        p.find('.avn_setting').each(function(idx,el){
            var name=$(el).attr('avn_name');
            if (name){
                var descr=self.gui.properties.getDescriptionByName(name);
                if (! descr) return;
                var val = descr.defaultv;
                var handler=self.allItems[name];
                if (handler) handler.write(val);
            }
        }) ;
    });

};
/**
 * create the html for a settings item
 * @private
 * @param {avnav.util.Property} descr
 * @param el
 */
Settingspage.prototype.createSettingHtml=function(descr,el){
    if (!(descr instanceof avnav.util.Property)) return;
    var self=this;
    var numdigits=0;
    var numdecimal=0;
    var value=this.gui.properties.getValue(descr);
    if (descr.type == avnav.util.PropertyType.CHECKBOX){
        var html='<label>'+descr.label;
        html+='<input type="checkbox" class="avn_settings_checkbox avn_setting" avn_name="'+descr.completeName+'"';
        if (value) html+="checked";
        html+='></input></label>';
        this.allItems[descr.completeName]= {
            read: function () {
                return $(el).find('input').is(':checked');
            },
            write: function (value) {
                $(el).find('input').prop('checked', value);
            }
        };
    }
    if (descr.type == avnav.util.PropertyType.RANGE){
        var html='<div class=""><div class="avn_slider_label" >'+descr.label+'</div>';
        html+='<div class="avn_slider_out avn_out">'+value+'</div>';
        var range=descr.values;
        numdigits=Math.ceil(Math.log(range[1])/Math.log(10));
        html+='<div class="avn_slider" ><input class="avn_setting" type="range" min="'+range[0]+'" max="'+range[1]+'" avn_name="'+descr.completeName+'" value="'+value+'"';
        if (range[2]) {
            html+=' step="'+range[2]+'"';
        }
        if (range[3]){
            numdecimal=range[3];
        }
        html+='/></div>';
        html+='<button class="avn_settings_reset avn_smallButton"></button>';
        html+='<div class="avn_clear"/>';
        html+='</div>';
        this.allItems[descr.completeName]= {
            read: function () {
                return parseFloat($(el).find('input').val());
            },
            write: function (value) {
                $(el).find('input').val(value).change();
            }
        };
    }
    if (descr.type == avnav.util.PropertyType.COLOR){
        var html='<div class=""><div class="avn_color_label" >'+descr.label+'</div>';
        html+='<div class="avn_color_out avn_out">'+value+'</div>';
        html+='<input type="color" class="avn_color avn_setting" avn_name="'+descr.completeName+'"/>';
        html+='<button class="avn_settings_reset avn_smallButton"></button>';
        html+='<div class="avn_clear"/>';
        html+='</div>';
        this.allItems[descr.completeName]= {
            read: function () {
                return $(el).find('input').val();
            },
            write: function (value) {
                $(el).find('input').val(value).change();
            }
        };
    }
    $(el).html(html);
    $(el).find('input[type="range"]').rangeslider({
            polyfill: false,
            onSlide: function(pos,val){
                val=self.formatter.formatDecimal(val,numdigits,numdecimal);
                $(el).find('.avn_out').text(val);
            },
            fillClass: 'avn_rangeslider__fill',
            handleClass: 'avn_rangeslider__handle'
        });
    $(el).find('input[type="color"]').each(function(idx,elx){
            if (elx.type === 'text'){
                //fallback if the browser does not support color input
                var cp=new jscolor.color(elx,{
                    hash:true,
                    pickerClosable:true
                });
                cp.fromString(value.replace(/^#/,''));
                $(elx).css('background-color',value);
                self.allItems[descr.completeName].write=function(val){
                    $(el).find('input').val(value).change();
                    $(elx).css('background-color',val);
                    cp.fromString(val.replace(/^#/,''));
                }
            }
    });

};

/**
 * @private
 * read all data and update the elements
 */
Settingspage.prototype.readData=function(){
    for (var idx in this.allItems){
        var value=this.gui.properties.getValueByName(idx);
        this.allItems[idx].write(value);
    }
};

Settingspage.prototype.showPage=function(options){
    if (!this.gui) return;
    this.readData();
    this.selectOnPage('input[type="range"]').rangeslider('update', true);
    this.store.resetData();
    this.store.updateSubItem(keys.sectionItems,sectionSelectors.selected,0,'selectors');

};
/**
 * called when the section selection has changed
 */
Settingspage.prototype.dataChanged=function(){
    var selectedSection=this.store.getData(keys.sectionItems,{}).selectors;
    var selectedIndex=selectedSection?selectedSection[sectionSelectors.selected]:0;
    this.createItemList(this.sectionItems[selectedIndex].name);
};
Settingspage.prototype.createItemList=function(sectionName){
    var items=settingsSections[sectionName]||[];
    var newItemList=[];
    items.forEach(function(item){
       newItemList.push({name:item})
    });
    this.store.updateSubItem(keys.activeItems,'itemList',newItemList);
};


Settingspage.prototype.hidePage=function(){

};



//-------------------------- Buttons ----------------------------------------


/**
 * activate settings and go back to main
 * @private
 */
Settingspage.prototype.btnSettingsOK=function(button,ev){
    avnav.log("SettingsOK clicked");
    var txt="";
    for (var idx in this.allItems){
        var val=this.allItems[idx].read();
        this.gui.properties.setValueByName(idx,val);
    }
    this.gui.properties.saveUserData(); //write changes to cookie
    this.gui.properties.updateLayout();  //update the layout based on less
    $(document).trigger(avnav.util.PropertyChangeEvent.EVENT_TYPE,new avnav.util.PropertyChangeEvent(this.gui.properties));
    this.gui.showPage('mainpage');
};

Settingspage.prototype.btnSettingsDefaults=function(button,ev) {
    avnav.log("SettingsDefaults clicked");
    for (var idx in this.allItems) {
        var val = this.gui.properties.getDescriptionByName(idx).defaultv;
        this.allItems[idx].write(val);
    }
};

Settingspage.prototype.btnSettingsAndroid=function(button,ev) {
    avnav.log("SettingsAndroid clicked");
    this.gui.showPage('mainpage');
    avnav.android.showSettings();
};


(function(){
    //create an instance of the status page handler
    var page=new Settingspage();
}());


