import React, {useState} from 'react';
import LayoutHandler, {LAYOUT_OPTIONS, LayoutPage} from '../util/layouthandler';
import {DialogButtons, DialogFrame, showDialog} from './OverlayDialog';
import {Checkbox} from './Inputs';
import DB from './DialogButton';
// @ts-ignore
import cloneDeep from "clone-deep";
// @ts-ignore
import {HelpButton,EditableParameterListUI} from './EditableParameterUI';
import {IDialogContext} from "./DialogContext";
import ButtonDefs from "./ButtonDefs";
import Helper from "../util/helper";
import globalstore from "../util/globalstore";
import keys from "../util/keys";
import {TEditableParameterUI} from "./ParameterDialog";

const OPTION_COMBINATIONS=[
    {
        display: 'default',
        options: []
    },
    {
        display: 'small',
        options: [LAYOUT_OPTIONS.SMALL]
    },
    {
        display: 'anchor',
        options: [LAYOUT_OPTIONS.ANCHOR]
    },
    {
        display: 'anchor+small',
        options: [LAYOUT_OPTIONS.ANCHOR,LAYOUT_OPTIONS.SMALL]
    }
];

const DEFAULT_OPTION_COMBINATION_INDEX=0; //this will always be returned from getFilteredOptions as first entry

const getFilteredOptions=(handledOptions:LAYOUT_OPTIONS[])=>{
    const rt=[];
    for (const i in OPTION_COMBINATIONS){
        const required=OPTION_COMBINATIONS[i].options;
        let matches=true;
        for (const k in required){
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
const optionListToObject=(optionList:LAYOUT_OPTIONS[],opt_false?:boolean)=>{
    const option:Partial<Record<LAYOUT_OPTIONS,boolean>> = {};
    optionList.forEach((el)=>{option[el]=opt_false?false:true;});
    return option;
};
class PanelListEntry{
    private pagename: string;
    private handledOptions: LAYOUT_OPTIONS[];
    basename: string;
    foundCombinations: boolean[];
    constructor(pagename:string,basename:string,handledOptions:LAYOUT_OPTIONS[]){
        this.pagename=pagename;
        this.handledOptions=handledOptions;
        this.basename=basename;
        //array of the same length like OPTION_COMBINATIONS
        this.foundCombinations=[];
    }
    hasOptionCombination(index:number){
        if (index < 0 || index >= this.foundCombinations.length) return false;
        return this.foundCombinations[index];
    }
    fillCombinations(){
        const combinations=getFilteredOptions(this.handledOptions);
        for (const i in combinations){
            const definition=combinations[i];
            const tryList=LayoutHandler.getPanelTryList(this.basename,optionListToObject(definition.options));
            //first element has the panel we check for
            const panelData=LayoutHandler.getDirectPanelData(this.pagename,tryList[0]);
            if (panelData){
                this.foundCombinations.push(true);
            }
            else{
                this.foundCombinations.push(false);
            }
        }
    }

    writePanelsToLayout(){
        const combinations=getFilteredOptions(this.handledOptions);
        for (let i=0;i<this.foundCombinations.length;i++){
            const definition=combinations[i];
            const shouldExist=this.foundCombinations[i];
            const tryList=LayoutHandler.getPanelTryList(this.basename,optionListToObject(definition.options));
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
const getPanelList=(page:string,panelNames:string[],handledOptions:LAYOUT_OPTIONS[])=>{
    const rt:Record<string,PanelListEntry>={};
    panelNames.forEach((pn)=>{
        const pe=new PanelListEntry(page,pn,handledOptions);
        pe.fillCombinations();
        rt[pn]=pe;
    });
    return rt;
};

export interface EditPageDialogProps{
    title?: string,
    page: string,
    panelNames: string[],
    handledOptions?: LAYOUT_OPTIONS[],
    parameters?: TEditableParameterUI[],
    pvalues?:Record<string, any>,
    updateValues?:(values:Record<string, any>) => void,
};

const buildHelp=(options:LAYOUT_OPTIONS[])=>{
    const conditionHelp={
        [LAYOUT_OPTIONS.SMALL]:'Layout if in portrait mode. This mode is assumed when the width is below '+
                        globalstore.getData(keys.properties.smallBreak)+"px. You can change this in the Display settings (general).",
        [LAYOUT_OPTIONS.ANCHOR]:'Layout if the anchor watch is active'
    }
    let rt= 'In this dialog you can define which panels should be visible in which conditions '+
        'and whether they have a common layout or a different layout for each condition.\n'+
        'In the conditions section you select for which condition you would like to modify the layout.\n'+
        'Remark: During layout editing those conditions will not automatically being set - you need to change them in this dialog.\n'+
        'Below at the Panel section you select for which of the condition combinations you will have a different layout.\n'+
        'The combination that will be used for the current conditions is marked grey.\n'+
        '\nConditions and their meaning:\n';
    for (const opt of options){
        const ohelp=conditionHelp[opt];
        if (ohelp){
            rt+=`${opt}:  ${ohelp}\n\n`;
        }
    }
    return rt;

}
const EditPageDialog=(props:EditPageDialogProps)=>{
        const [currentOptions,setCurrentOptions]=useState(LayoutHandler.getOptionValues(props.handledOptions));
        const [panelList,setPanelList]=useState(getPanelList(props.page,props.panelNames,props.handledOptions));
        const [values,setValues]=useState(props.pvalues||{});
            
    const getPanelsAsArray=()=>{
        const rt=[];
        for (const k in panelList){
            rt.push(panelList[k]);
        }
        return rt;
    }
    const setMode=(option:LAYOUT_OPTIONS)=>{
        setCurrentOptions((old)=>{
            const rt={...old};
            rt[option]=!old[option]
            return rt;
        })
    }
    const setCombination=(panel:PanelListEntry,index:number)=>{
        const nv=cloneDeep(panelList);
        nv[panel.basename].foundCombinations[index]=!nv[panel.basename].foundCombinations[index];
        setPanelList(nv);
    }
    const combinations=getFilteredOptions(props.handledOptions);
    //find the current active option combination index
    let activeIndex:number;
    combinations.forEach((combination,index)=>{
        const required=optionListToObject(combination.options);
        let match=true;
        for (const k of props.handledOptions) {
            if (!!required[k] != !!currentOptions[k]){
                match=false;
                break;
            }
        }
        if (match){
            activeIndex = index;
        }
    })
    if (activeIndex===undefined){
        activeIndex=0;
    }
    let dataValid=true;
    if (props.parameters) {
        props.parameters.forEach((parameter) => {
            if (!parameter.checkConditions(values,props.parameters)) return;
            if (parameter.hasError(values || {})) {
                dataValid = false;
            }
        })
    }
        return (
            <DialogFrame className="selectDialog editPageDialog" title={props.title}>
                <div className="info"><span className="label">Page:</span>{props.page}</div>
                {props.parameters && <EditableParameterListUI
                    values={values}
                    parameters={props.parameters}
                    initialValues={props.pvalues||{}}
                    onChange={(nv:any)=>{
                        setValues({...values,...nv});
                    }}
                />
                }
                <div className="selectCurrent" >
                    <div className="currentHeadline">Current Conditions</div>
                    <div className={'dialogRow'}>
                    {props.handledOptions.map((option)=>{
                            return(
                                <Checkbox className="modeSelect"
                                          dialogRow={true}
                                          onClick={()=>{setMode(option)}}
                                          key={option}
                                          label={option}
                                          value={currentOptions[option]}  />

                                )
                            }
                    )}
                        <HelpButton description={buildHelp(props.handledOptions)}/>
                    </div>
                </div>
                <div className="panelList">
                    <div className="panelHeadline">Panel Configurations</div>
                {getPanelsAsArray().map((panel)=>{
                    const activePanelIndex=panel.foundCombinations[activeIndex]?activeIndex:
                        (panel.foundCombinations[DEFAULT_OPTION_COMBINATION_INDEX]?DEFAULT_OPTION_COMBINATION_INDEX:undefined);
                    return <div className={"editPanel "+panel.basename} key={panel.basename.replace(/  */,'')}>
                        <span className="label">{panel.basename}</span>
                        <div className="combinationFrame">
                        { getFilteredOptions(props.handledOptions).map((combination,index)=>{
                            return(
                                <Checkbox className={Helper.concatsp("combinationSelect",(activePanelIndex == index)?'selectedItem':undefined)}
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
                    <DB {...ButtonDefs.DBCancel}/>
                    <DB {...ButtonDefs.DBOk}
                        onClick={()=>{
                        for (const pn in panelList){
                            const panel=panelList[pn];
                            panel.writePanelsToLayout();
                        }
                        LayoutHandler.setTemporaryOptionValues(currentOptions);
                        if (props.updateValues) props.updateValues(values);
                    }}
                        disabled={!dataValid}
                    />

                </DialogButtons>
            </DialogFrame>
        );
}


/**
 *
 * @param pagename
 * @param panelnames
 * @param handledOptions
 * @param opt_dialogContext
 * @return {boolean}
 */
export const createDialog=(pagename:LayoutPage,panelnames:string[],
                             handledOptions:LAYOUT_OPTIONS[],
                             opt_dialogContext?:IDialogContext)=>{
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

export const RawButtonDef={
        ...ButtonDefs.EditPage,
        editOnly: true,
        visible: true,
};

export default  EditPageDialog;