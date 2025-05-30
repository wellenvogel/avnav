import React, {useState} from 'react';
import PropTypes from 'prop-types';
import LayoutHandler from '../util/layouthandler.js';
import {DialogButtons, DialogFrame, showDialog} from './OverlayDialog.jsx';
import {Checkbox} from './Inputs.jsx';
import DB from './DialogButton.jsx';
import cloneDeep from "clone-deep";

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

const EditPageDialog=(props)=>{
        const page=props.page;
        const [currentOptions,setCurrentOptions]=useState(LayoutHandler.getOptionValues(props.handledOptions));
        const [panelList,setPanelList]=useState(getPanelList(props.page,props.panelNames,props.handledOptions));
            
    const getPanelsAsArray=()=>{
        let rt=[];
        for (let k in panelList){
            rt.push(panelList[k]);
        }
        return rt;
    }
    const setMode=(option)=>{
        setCurrentOptions((old)=>{
            let rt={...old};
            rt[option]=!old[option]
            return rt;
        })
    }
    const setCombination=(panel,index)=>{
        let nv=cloneDeep(panelList);
        nv[panel.basename].foundCombinations[index]=!nv[panel.basename].foundCombinations[index];
        setPanelList(nv);
    }
        return (
            <DialogFrame className="selectDialog editPageDialog" title={props.title}>
                <div className="info"><span className="label">Page:</span>{props.page}</div>
                <div className="selectCurrent" >
                    <div className="currentHeadline">Current Conditions</div>
                    {props.handledOptions.map((option)=>{
                            return(
                                <Checkbox className="modeSelect"
                                          onClick={()=>{setMode(option)}}
                                          key={option}
                                          label={option}
                                          value={currentOptions[option]}  />

                                )
                            }
                    )}
                </div>
                <div className="panelList">
                    <div className="panelHeadline">Panel Configurations</div>
                {getPanelsAsArray().map((panel)=>{
                    return <div className={"editPanel "+panel.basename} key={panel.basename.replace(/  */,'')}>
                        <span className="label">{panel.basename}</span>
                        <div className="combinationFrame">
                        { getFilteredOptions(props.handledOptions).map((combination,index)=>{
                            return(
                                <Checkbox className="combinationSelect"
                                          onClick={()=>{setCombination(panel,index)}}
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
                <DialogButtons>
                    <DB name="cancel" >Cancel</DB>
                    <DB name="ok" onClick={()=>{
                        for (let pn in panelList){
                            let panel=panelList[pn];
                            panel.writePanelsToLayout();
                        }
                        LayoutHandler.setTemporaryOptionValues(currentOptions);
                    }}>Ok</DB>

                </DialogButtons>
            </DialogFrame>
        );
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
 * @param handledOptions
 * @param opt_dialogContext
 * @return {boolean}
 */
EditPageDialog.createDialog=(pagename,panelnames,handledOptions,opt_dialogContext)=>{
    if (! LayoutHandler.isEditing()) return false;
    showDialog(opt_dialogContext,(props)=> {
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

EditPageDialog.getButtonDef=(pagename,panelNames,handledOptions,opt_dialogContext)=>{
    return{
        name: 'EditPage',
        editOnly: true,
        onClick:()=>{
            EditPageDialog.createDialog(pagename,panelNames,handledOptions,opt_dialogContext);
        }
    }

};

export default  EditPageDialog;