/**
 * Created by Andreas on 27.04.2014.
 */
var ItemList=require('../components/ItemListOld.jsx');
var React=require('react');
var ItemUpdater=require('../components/ItemUpdater.jsx');

var keys={
  info:'info'
};


/**
 *
 * @constructor
 */
var Infopage=function(){
    avnav.gui.Page.call(this,'infopage');
    this.statusQuery=0; //sequence counter
};
avnav.inherits(Infopage,avnav.gui.Page);



Infopage.prototype.showPage=function(options){
    if (!this.gui) return;
    this.doQuery();
};

Infopage.prototype.doQuery=function(){
    var self=this;
    var url="info.html";
    $.ajax({
        url: url,
        dataType: 'html',
        cache:	false,
        success: function(data,status){
            self.store.storeData(keys.info,{info:data});
        }
    });
    var url="license.html";
    $.ajax({
        url: url,
        dataType: 'html',
        cache:	false,
        success: function(data,status){
            self.store.storeData(keys.info,{license:data});
        }
    });
    var url="privacy-en.html";
    $.ajax({
        url: url,
        dataType: 'html',
        cache:	false,
        success: function(data,status){
            self.store.storeData(keys.info,{privacy:data});
        }
    });

};

Infopage.prototype.hidePage=function(){
};





Infopage.prototype.getPageContent=function(){
    let self=this;
    let buttons=[
        {key:'Cancel'}
    ];
    this.setButtons(buttons);
    let Headline=function(props){
        return <div className="avn_left_top">License and Privacy Info</div>
    };
    class Main extends React.Component{
        constructor(props){
            super(props);
            this.showLicense=this.showLicense.bind(this);
            this.showPrivacy=this.showPrivacy.bind(this);
        }

        render(){
            let rc=this;
            return(
                <div className="avn_panel_fill_flex">
                    <Headline/>
                    <div className="avn_linkWrapper">
                        <div className="avn_link" onClick={rc.showLicense}>License</div>
                        <div className="avn_link" onClick={rc.showPrivacy}>PrivacyInfo</div>
                    </div>
                    <div className="avn_listWrapper">
                        <div className="avn_infoFrame" ref="infoFrame">
                            <div className="avn_infoText" dangerouslySetInnerHTML={{__html: this.props.info}} ref="info">
                            </div>
                            <div className="avn_licenseText" dangerouslySetInnerHTML={{__html: this.props.license}} >
                            </div>
                            <div className="avn_privacyText" dangerouslySetInnerHTML={{__html: this.props.privacy}} ref="privacy">
                            </div>
                        </div>
                    </div>
                    {self.getAlarmWidget()}
                </div>
            );
        }

        showLicense(){
            let target=this.refs.info;
            if (! target) return;
            let parent=this.refs.infoFrame;
            if (! parent) return;
            parent.scrollTop=0;
        }
        showPrivacy(){
            let target=this.refs.privacy;
            if (! target) return;
            let parent=this.refs.infoFrame;
            if (! parent) return;
            parent.scrollTop=target.offsetTop;
        }
    };
    return ItemUpdater(Main,self.store,keys.info);
};

//-------------------------- Buttons ----------------------------------------


(function(){
    //create an instance of the status page handler
    var page=new Infopage();
}());


