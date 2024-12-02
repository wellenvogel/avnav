import React from 'react';
import PropTypes from 'prop-types';
import LayoutHandler from '../util/layouthandler.js';
import OverlayDialog from './OverlayDialog.jsx';
import assign from 'object-assign';
import {Checkbox} from './Inputs.jsx';
import DB from './DialogButton.jsx';

const OPTION_COMBINATIONS=[
    {
        display: 'default',
        options: []
    },
    {
        display: 'small',
        options: [LayoutHandler.OPTIONS.SMALL]
    },
    {
        display: 'anchor',
        options: [LayoutHandler.OPTIONS.ANCHOR]
    },
    {
        display: 'anchor+small',
        options: [LayoutHandler.OPTIONS.ANCHOR,LayoutHandler.OPTIONS.SMALL]
    }
];

const getFilteredOptions=(handledOptions)=>{
    let rt=[];
    for (let i in OPTION_COMBINATIONS){
        let required=OPTION_COMBINATIONS[i].options;
        let matches=true;
        for (let k in required){
            if (handledOptions.indexOf(required[k])<0){
                matches=false;
                break;
            }
        }
        if (matches){
            rt.push(OPTION_COMBINATIONS[i]);
        }
    }
    return rt;
};
const optionListToObject=(optionList,opt_false)=>{
    let option={};
    optionList.forEach((el)=>{option[el]=opt_false?false:true;});
    return option;
};
class PanelListEntry{
    constructor(pagename,basename,handledOptions){
        this.pagename=pagename;
        this.handledOptions=handledOptions;
        this.basename=basename;
        //array of the same length like OPTION_COMBINATIONS
        this.foundCombinations=[];
    }
    hasOptionCombination(index){
        if (index < 0 || index >= this.foundCombinations.length) return false;
        return this.foundCombinations[index];
    }
    fillCombinations(){
        let combinations=getFilteredOptions(this.handledOptions);
        for (let i in combinations){
            let definition=combinations[i];
            let tryList=LayoutHandler.getPanelTryList(this.basename,optionListToObject(definition.options));
            //first element has the panel we check for
            let panelData=LayoutHandler.getDirectPanelData(this.pagename,tryList[0]);
            if (panelData){
                this.foundCombinations.push(true);
            }
            else{
                this.foundCombinations.push(false);
            }
        }
    }

    writePanelsToLayout(){
        let combinations=getFilteredOptions(this.handledOptions);
        for (let i=0;i<this.foundCombinations.length;i++){
            let definition=combinations[i];
            let shouldExist=this.foundCombinations[i];
            let tryList=LayoutHandler.getPanelTryList(this.basename,optionListToObject(definition.options));
            if (! shouldExist){
                LayoutHandler.removePanel(this.pagename,tryList[0]);
            }
            else
            {
                LayoutHandler.getDirectPanelData(this.pagename,tryList[0],true);
            }
        }
    }
}
const getPanelList=(page,panelNames,handledOptions)=>{
    let rt={};
    panelNames.forEach((pn)=>{
        let pe=new PanelListEntry(page,pn,handledOptions);
        pe.fillCombinations();
        rt[pn]=pe;
    });
    return rt;
};

class EditPageDialog extends React.Component{
    constructor(props){
        super(props);
        this.state= {
            page:props.page,
            currentOptions: LayoutHandler.getOptionValues(props.handledOptions),
            panelList:getPanelList(props.page,props.panelNames,props.handledOptions),
            sizeCount: 0
        };
        this.sizeCount=0;
        this.setMode=this.setMode.bind(this);
    }
    getPanelsAsArray(){
        let rt=[];
        for (let k in this.state.panelList){
            rt.push(this.state.panelList[k]);
        }
        return rt;
    }
    setMode(option){
        let nv=assign({},this.state.currentOptions);
        nv[option]=!nv[option];
        this.setState({currentOptions:nv});
    }
    setCombination(panel,index){
        let nv=assign({},this.state.panelList);
        nv[panel.basename].foundCombinations[index]=!nv[panel.basename].foundCombinations[index];
        this.setState({panelList:nv});
    }
    render () {
        let self=this;
        let panels=this.state.panelList;
        return (
            <React.Fragment>
            <div className="selectDialog editPageDialog">
                <h3 className="dialogTitle">{this.props.title}</h3>
                <div className="info"><span className="label">Page:</span>{this.props.page}</div>
                <div className="selectCurrent" >
                    <div className="currentHeadline">Current Conditions</div>
                    {this.props.handledOptions.map((option)=>{
                            return(
                                <Checkbox className="modeSelect"
                                          onClick={()=>{this.setMode(option)}}
                                          key={option}
                                          label={option}
                                          value={this.state.currentOptions[option]}  />

                                )
                            }
                    )}
                </div>
                <div className="panelList">
                    <div className="panelHeadline">Panel Configurations</div>
                {this.getPanelsAsArray().map((panel)=>{
                    return <div className={"editPanel "+panel.basename} key={panel.basename.replace(/  */,'')}>
                        <span className="label">{panel.basename}</span>
                        <div className="combinationFrame">
                        { getFilteredOptions(this.props.handledOptions).map((combination,index)=>{
                            return(
                                <Checkbox className="combinationSelect"
                                          onClick={()=>{this.setCombination(panel,index)}}
                                          key={combination.display}
                                          label={combination.display}
                                          value={panel.foundCombinations[index]}
                                />
                            )
                        })}
                        </div>
                        </div>
                })}
                </div>
                <div className="dialogButtons">
                    <DB name="cancel" onClick={this.props.closeCallback}>Cancel</DB>
                    <DB name="ok" onClick={()=>{
                        this.props.closeCallback();
                        for (let pn in this.state.panelList){
                            let panel=this.state.panelList[pn];
                            panel.writePanelsToLayout();
                        }
                        LayoutHandler.setTemporaryOptionValues(this.state.currentOptions);
                    }}>Ok</DB>

                </div>
            </div>
            </React.Fragment>
        );
    }
}

EditPageDialog.propTypes={
    title: PropTypes.string,
    page: PropTypes.string,
    panelNames: PropTypes.array,
    supportedOptions: PropTypes.array,
    closeCallback: PropTypes.func.isRequired
};

/**
 *
 * @param pagename
 * @param panelnames
 * @return {boolean}
 */
EditPageDialog.createDialog=(pagename,panelnames,handledOptions)=>{
    if (! LayoutHandler.isEditing()) return false;
    OverlayDialog.dialog((props)=> {
        return <EditPageDialog
            {...props}
            title="Edit Page Layout"
            page={pagename}
            panelNames={panelnames}
            handledOptions={handledOptions}
            />
    });
    return true;
};

EditPageDialog.getButtonDef=(pagename,panelNames,handledOptions)=>{
    return{
        name: 'EditPage',
        editOnly: true,
        onClick:()=>{
            EditPageDialog.createDialog(pagename,panelNames,handledOptions);
        }
    }

};

export default  EditPageDialog;