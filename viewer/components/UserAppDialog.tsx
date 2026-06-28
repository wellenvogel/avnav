import React, {SyntheticEvent, useEffect, useState} from 'react';
import {DBCancel, DBOk, DialogButtons, DialogFrame, DialogText, showPromiseDialog} from './OverlayDialog';
import Toast from './Toast';

import Addons, {getAllAddons, InternalAddonProps} from '../util/Addons';
import Helper, {avitem, concatsp, getav, unsetOrTrue} from '../util/helper';
import Requests from '../util/requests';
import UploadHandler, {uploadClick} from "./UploadHandler";
import globalStore from "../util/globalstore";
import keys from "../util/keys";
import {EditDialog, EditDialogWithSave, getTemplate, uploadFromEdit} from "./EditDialog";
import {ConfirmDialog, SelectList} from "./BasicDialogs";
import {checkName, ItemNameDialog} from "./ItemNameDialog";
// @ts-ignore
import {createItemActions} from "./FileDialog";
import {IDialogContext, useDialogContext} from "./DialogContext";
import {Item} from "../util/itemFunctions";
import {Value} from "../util/EditableParameter";
import {
    EditableBooleanParameterUI,
    EditableCustomDialogUI,
    EditableIconParameterUI,
    EditableSelectParameterUI,
    EditableStringParameterUI
    // @ts-ignore
} from "./EditableParameterUI";
import {getPageTitle, PAGEIDS, PageType, PLUGINPAGES} from "../util/pageids";
import ButtonDefs from "./ButtonDefs";
import {ParameterDialog, ParameterType} from "./ParameterDialog";
import {WidgetParameterValue} from "../api/api.interface";
import base from "../base";
import {useHistory} from "./HistoryProvider";
import {ListItem, ListMainSlot, ListSlot} from "./ListItems";
import Button, {ButtonEventHandler} from "./Button";
import {iconClasses} from './Icons';
import ItemList from "./ItemList";
import {IHistory} from "../util/history";

export interface InternalAddonDisplayProps extends InternalAddonProps{
    buttonKey?:string
}
interface SelectHtmlDialogProps{
    allowUpload?:boolean;
    current?:string
    resolveFunction:(url:string) => void
}

const SelectHtmlDialog=({allowUpload,resolveFunction,current}:SelectHtmlDialogProps)=>{
    const dialogContext=useDialogContext();
    const [uploadFile,setUploadFile]=useState(undefined);
    const [userFiles,setUserFiles]=useState([]);
    const listFiles=(name?:string)=>{
        Requests.getJson({
            request:'api',
            type:'user',
            command:'list'
        })
            .then((data) => {
                const nuserFiles:Item[] = [];
                if (data.items) {
                    data.items.forEach((el:Item) => {
                        if (Helper.getExt(el.name) === 'html') {
                            el.label = el.name;
                            el.value = el.url;
                            if (el.url === current) el.selected=true;
                            nuserFiles.push(el);
                            if (name && el.name === name) {
                                resolveFunction(el.url);
                                dialogContext.closeDialog();
                            }
                        }
                    });
                    setUserFiles(nuserFiles)
                }
            }).catch(() => {
        });
    }
    useEffect(() => {
        listFiles();
    }, []);
    const uploadAction=createItemActions('user').getUploadAction().copy({
        preCheck: (_userData:any, name:string)=>{
            if (! name) throw new Error("no file name");
            if (Helper.getExt(name)!=='html') throw new Error("only HTML files");
            return {name:name};
        },
        withDialog:true
    });
    const checkNameFunction=(name:string)=>checkName(name,userFiles)
    return <DialogFrame title={"Select HTML file"}>
        <UploadHandler
            file={uploadFile}
            type={'user'}
            checkNameCallback={async (file)=>{
                return uploadAction.checkFile(file,dialogContext);
            }}
            doneCallback={(v)=>{
                setUploadFile(undefined);
                listFiles(v.name)
            }}
            errorCallback={(err)=>{
                setUploadFile(undefined);
                Toast(err);
            }}
        />
        <SelectList
            list={userFiles}
            onClick={(el)=>{
                dialogContext.closeDialog();
                resolveFunction(el.url);
            }}
        />
        <DialogButtons buttonList={[
            {
                ...ButtonDefs.Upload,
                onClick: ()=>{
                    uploadClick((ev)=>setUploadFile(ev.target.files[0]),'.html');
                },
                visible: (allowUpload === undefined|| allowUpload) && globalStore.getData(keys.gui.capabilities.uploadUser),
                close: false
            },
            {
                ...ButtonDefs.DBNew,
                onClick: () => {
                    dialogContext.showDialog(()=><ItemNameDialog
                        iname={""}
                        fixedExt={"html"}
                        mandatory={(v:string)=>!v}
                        checkName={checkNameFunction}
                        resolveFunction={(res?:{name:string})=>{
                            let name=res?.name;
                            if (!name) return;
                            name=name+".html";
                            const data = getTemplate(name);
                            dialogContext.showDialog(() => <EditDialogWithSave
                                data={data}
                                fileName={name}
                                resolveFunction={() => {
                                    listFiles(name);
                                }}
                                type={'user'}
                            />)
                            return false;
                        }}/>
                    )
                },
                visible: (allowUpload === undefined|| allowUpload) && globalStore.getData(keys.gui.capabilities.uploadUser),
                close: false
            },
            DBCancel()

        ]}/>
    </DialogFrame>
}

interface TranslateUrlDialogProps {
    resolveFunction:(url:string) => void
    current?:string
}

const TranslateUrlDialog=({resolveFunction,current}:TranslateUrlDialogProps)=>{
    const dialogContext=useDialogContext();
    useEffect(() => {
        (async ()=> {
            try {
                const data = await Requests.getJson({
                    request:'api',
                    command:'list',
                    type:'user'
                });
                if (data.items) {
                    data.items.forEach((el:Item) => {
                        if (Helper.getExt(el.name) === 'html') {
                            if (el.url === current) {
                                dialogContext.closeDialog();
                                resolveFunction(el.name);
                            }
                        }
                    });
                }
            } catch (error) { /* empty */ }
            dialogContext.closeDialog();
        })();
    }, []);
    return <DialogFrame title={"loading..."}/>
}
interface SelectExistingDialogProps{
    existingAddons:InternalAddonDisplayProps[],
    resolveFunction:(addon?:Partial<InternalAddonDisplayProps>) => void,
    showNew?:boolean,
    url:string,
}
const SelectExistingDialog=({
                                existingAddons,
                                resolveFunction,
                                url,
                                showNew}:SelectExistingDialogProps)=>{
    const dialogContext=useDialogContext();
    const selist:AddonItemProps[] = [];
    existingAddons.forEach((addon) => {
        selist.push({...addon,preventButton:true})
    })
    return <DialogFrame
        className="selectDialog"
        title="Select Addon to Edit"
    >
        <DialogText>{url}</DialogText>
        <ItemList
            itemList={selist}
            itemClass={AddonItem}
            onItemClick={(ev)=>{
                const item: InternalAddonProps = avitem(ev);
                resolveFunction(item);
                dialogContext.closeDialog();
            }}/>
        <DialogButtons buttonList={[
            {
                ...ButtonDefs.DBNew,
                visible: showNew,
                onClick:()=>resolveFunction({url:url})
            },
            DBCancel()
        ]}/>
    </DialogFrame>
}

export const getAddonsByUrl=(url:string)=>{
    const addons=getAddonsForDisplay();
    const foundAddons:InternalAddonDisplayProps[]=[];
    for (const ao of addons){
        if (ao.url === url){
            foundAddons.push(ao);
        }
    }
    return foundAddons;
}
export const getAddonsByPluginName=(name:string):InternalAddonProps[]=>{
    if (! name) return []
    const key="plugin-"+name; //TODO: should get the prefix from somewhere
    const altKey="cl-plugin-"+name;
    const all=getAllAddons();
    const rt:InternalAddonProps[]=[];
    for (const addon of all){
        if (addon.source === key || addon.source === altKey){
            rt.push(addon);
        }
    }
    return rt;
}

export const selectAddonForPlugin=(dialogContext:IDialogContext,history:IHistory,pluginName:string)=>{
    if (! pluginName) return;
    const pluginAddons=getAddonsByPluginName(pluginName);
    if (!pluginAddons?.length) return;
    if (pluginAddons.length === 1){
        runAddonAction(pluginAddons[0],history);
        dialogContext.closeDialog();
        return;
    }
    dialogContext.showDialog(()=><DialogFrame title={"Select App/Button"}>
            <ItemList
                itemList={pluginAddons}
                itemClass={(item)=><AddonItem {...item} preventButton={true}/>}
                onItemClick={(ev)=>{
                    const item=avitem(ev);
                    runAddonAction(item,history);
                    dialogContext.closeDialog();
                }}
                />
        <DialogButtons buttonList={[DBCancel()]}/>
        </DialogFrame>
        );
}

export const selectAddonForEdit=(
    dialogContext:IDialogContext,
    url:string,
    ):Promise<void|Partial<InternalAddonProps>> => {
    if (! url) return Promise.reject();
    const foundAddons:InternalAddonDisplayProps[]=getAddonsByUrl(url);
    if (foundAddons.length < 1){
        return Promise.resolve({url:url});
    }
    return showPromiseDialog(dialogContext,(dp)=><SelectExistingDialog
        existingAddons={foundAddons}
        url={url}
        {...dp}/>)
}

const checkUrl=(val:string|URL,isInternal?:boolean)=>{
    if (! val) return false;
    if (isInternal){
        if ((val+"").match(/^http/i)) return false;
        return true;
    }
    if (!(val+"").match(/^https*:\/\//i)) return false;
    return true;
}

export interface UserAppDialogProps{
    showToasts?:boolean ;
    addon?:Partial<InternalAddonProps>,
    resolveFunction?:() => void
}
const getPageLabel=(page:PageType)=>{
    return `${page} [${getPageTitle(page)}]`
}

interface AppDialogValues{
    [key:string]:WidgetParameterValue,
    internalUrl?: string,
    externalUrl?: string,
    name:string,
    icon?:string
    internal:boolean,
    title?:string,
    newWindow?:boolean,
    displayPage?:string //we cannot use page as the class 'page' would kill the layout
    shortText?:string
    longText?:string,
    buttonClass?:string,
    canDelete?:boolean,
}

const buildDialogParameters=(canEdit:boolean)=> {
    const rt: ParameterType[] = [];
        rt.push(new EditableBooleanParameterUI({
            name: 'internal',
            defaultValue: true,
            displayName: 'internal',
            description: 'If checked you can select a HTML page from the AvNav user files to be shown as user app. If unchecked you can select an external URL.',
            condition:{internal:()=> canEdit}
        }))
        rt.push(new EditableStringParameterUI({
            name: 'externalUrl',
            displayName: 'external url',
            readOnly: !canEdit,
            condition: {
                internal: false,
                fixedUrl:(v:Value)=>!v,
                externalUrl:(v:Value)=>canEdit || !!v
            },
            checker: canEdit?(value: string) => checkUrl(value, false):undefined,
            mandatory: canEdit,
            description: 'An external URL. The URL must start with http[s]. You can use $HOST in the url to let AvNav replace this with the IP of the AvNav server dynamically.',
        }));
        rt.push(new EditableCustomDialogUI({
            name: 'internalUrl',
            displayName: 'internal url',
            readOnly: !canEdit,
            condition: {internal: true,
                fixedUrl:(v:Value)=>!v,
                internalUrl:(v:Value)=>canEdit || !!v
            },
            checker: canEdit?(value: string) => checkUrl(value, true):undefined,
            mandatory: canEdit,
            description: 'An internal URL. The URL must not start with http[s]',
            onClick:(ev:SyntheticEvent) => {
                const av=getav(ev);
                if (!av?.dialogContext|| ! av?.param || !av?.onChange) return;
                av.dialogContext.showDialog(()=>{
                    return <SelectHtmlDialog
                        resolveFunction={(url)=>
                            av.onChange(av.param.setValue(undefined,url))
                        }
                        current={av.param.getValue(av.currentValues)}
                    />
                })
            }
        }));
        rt.push(new EditableIconParameterUI({
            name:'icon',
            displayName:'icon',
            readOnly: !canEdit,
            description:'The button icon to be shown',
            mandatory: canEdit,
            condition: {icon:(v:Value)=>canEdit||!!v}
        }))
        rt.push(new EditableStringParameterUI({
            name:'title',
            displayName:'title',
            readOnly: !canEdit,
            condition: {title: (v:Value)=>canEdit || !!v,
                newWindow:(v:Value)=>!Helper.unsetorTrue(v)},
            description:'If set AvNav will show a title bar wit this text'
        }))
        rt.push(new EditableBooleanParameterUI({
            name:'newWindow',
            displayName:'newWindow',
            readOnly: !canEdit,
            condition:{internal:false, newWindow:(v:Value)=>canEdit || !!v},
            description:'If set the user app will be shown outside of AvNav in a new window',
        }))
        rt.push(new EditableSelectParameterUI({
            name:'displayPage',
            displayName:'page',
            readOnly: !canEdit,
            default:PAGEIDS.ADDON,
            list:Object.values(PLUGINPAGES).map((page)=>{
                    const label=getPageLabel(page);
                    return {label:label,value:page}
                }).concat({label:'--default--',value:''}),
            condition:{newWindow:false},
            description:'The page in AvNav to show this user app'
        }))
        rt.push(new EditableStringParameterUI({
            name:'shortText',
            displayName:'shortText',
            readOnly: !canEdit,
            description: 'The short text to be shown on the button (max 7. characters)',
            checker: canEdit?(value: string)=>{
                if (! value) return true;
                if (value.length > 7) return false;
                return true;
            }:undefined
        }))
        rt.push(new EditableStringParameterUI({
            name:'longText',
            displayName:'longText',
            readOnly: !canEdit,
            description: 'The long text to be shown on tool tips or in the main menu'
        }))
        rt.push(new EditableStringParameterUI({
            name:'buttonClass',
            displayName:'button',
            readOnly: true,
            description: 'The class name for the button. You need this to customize the button via CSS. Read-Only.'
        }))
    return rt;
}

const hasExternalUrl=(item:{url?:string|URL})=>{
    const url=item?.url;
    if (! url) return false;
    return (url+"").toLowerCase().match('^https*:');
}

const addonToParam=(addon:Partial<InternalAddonProps>)=>{
    const rt:AppDialogValues= {
        internal: !hasExternalUrl(addon),
        name:addon.name,
    }
    if (rt.internal) rt.internalUrl=(addon.originalUrl||addon.url) as string;
    else rt.externalUrl=(addon.originalUrl || addon.url) as string;
    rt.title=addon.title as string;
    rt.icon=addon.button?.icon as string;
    rt.displayPage=(Array.isArray(addon.page)?addon.page[0]:addon.page) ||'';
    rt.shortText=addon.button?.shortText as string;
    rt.longText=addon.button?.longText as string;
    rt.buttonClass=addon.buttonClass as string;
    rt.canDelete=addon.canDelete;
    rt.newWindow=addon.newWindow;
    return rt;
}


const UserAppDialog = (props:UserAppDialogProps) => {
    const currentAddon=addonToParam(props.addon||{});
    const dialogContext = useDialogContext();
    const canEdit = unsetOrTrue(currentAddon.canDelete);
    let title = "Show ";
    if (canEdit) title = currentAddon.name ? "Modify " : "Create ";
    const parameters = buildDialogParameters(canEdit);
    return <ParameterDialog
        title={title + 'User App'}
        parameters={parameters}
        values={currentAddon}
        onChange={(_ev, values) => {
            base.log("values changed", values);
            return values
        }}
        buttons={[
            {
                ...ButtonDefs.Edit,
                close: false,
                onClick: async () => {
                    let name;
                    try {
                        name = await showPromiseDialog(dialogContext, TranslateUrlDialog, {current: currentAddon.url});
                    } catch (e) {
                        Toast("unable to find file for " + currentAddon.url);
                        return;
                    }
                    try {
                        const data = await Requests.getHtmlOrText({
                            request: 'api',
                            command: 'download',
                            type: 'user',
                            name: name,
                            noattach: true
                        });
                        dialogContext.showDialog(() => <EditDialog
                            data={data}
                            fileName={name}
                            title={"Edit " + name}
                            saveFunction={async (mData) => await uploadFromEdit(name, mData, true, 'user')}
                            resolveFunction={async (mData) => await uploadFromEdit(name, mData, true, 'user')}
                        />)
                    } catch (e) {
                        if (e) Toast(e);
                    }
                },
                visible: !!currentAddon.url && Helper.startsWith(currentAddon.url + "", "/user/viewer") &&
                    currentAddon.canDelete && canEdit && currentAddon.internal
            },
            {
                ...ButtonDefs.DBDelete,
                onClick: () => {
                    showPromiseDialog(dialogContext, (dprops) => <ConfirmDialog {...dprops}
                                                                                text={"really delete User App?"}/>)
                        .then(() => {
                                Addons.removeAddon(currentAddon.name)
                                    .then(() => {
                                        props.resolveFunction();
                                        dialogContext.closeDialog();
                                    })
                                    .catch((error) => {
                                        if (unsetOrTrue(props.showToasts)) Toast("unable to remove: " + error);
                                    });
                            }
                            , () => {
                            });
                },
                close: false,
                visible: !!currentAddon.name && currentAddon.canDelete && canEdit
            },
            DBCancel(),
            DBOk((ev: SyntheticEvent) => {
                    const current: AppDialogValues = getav(ev).currentValues;
                    const name = props.addon?.name;
                    const url = current.internal ? current.internalUrl : current.externalUrl;
                    const icon = current.icon;
                    const newWindow = current.newWindow;
                    const page = current.displayPage;
                    const title = current.title;
                    const shortText=current.shortText;
                    const longText=current.longText;

                    Addons.updateAddon(name, url,
                        icon, title, newWindow,
                        page,shortText,longText)
                        .then(() => {
                            props.resolveFunction();
                            dialogContext.closeDialog();
                        })
                        .catch((error) => {
                            if (unsetOrTrue(props.showToasts)) Toast("unable to add/update: " + error);
                        });

                },
                {
                    visible: canEdit
                }
            )
        ]}
    />

}

export default UserAppDialog;

interface AddonItemProps extends InternalAddonProps {
    className?: string;
    onClick?: ButtonEventHandler,
    buttonKey?: string,
    selected?: boolean;
    preventButton?:boolean;
}

const runAddonAction=(props:AddonItemProps,history:IHistory)=>{
    if (props.newWindow) {
        window.open(props.url, props.name);
        return;
    }
    let page: string;
    const pageList = Array.isArray(props.page) ? props.page : [props.page || PAGEIDS.ADDON]
    for (const pg of pageList) {
        if (Object.values(PLUGINPAGES).indexOf(pg) >= 0) {
            page = pg;
            break;
        }
    }
    if (!page) page = PAGEIDS.ADDON;
    if (page === PAGEIDS.ACTIONS) {
        if (props.button?.onClick){
            props.button.onClick(new Event("click"));
        }
        return;
    }
    history.push(page, {button: props.buttonKey || props.key || props.name})
}

export const AddonItem = (props: AddonItemProps) => {
    const history = useHistory();
    let source = props.source || 'user';
    if (props.invalid) source += ", invalid";
    if (props.newWindow) source += ", new window";
    let url = ((props.originalUrl !== undefined) ? props.originalUrl : props.url);
    if (url) url = url + "";
    const pages = Array.isArray(props.page) ? props.page : [props.page || PAGEIDS.ADDON];
    return (
        <ListItem
            selected={props.selected}
            className={concatsp("addonItem",
                props.invalid ? "invalid" : undefined,
                props.className)}
            onClick={props.onClick}>
            <ListSlot>
                {props.buttonClass && <Button
                    setFontSize={true}
                    name={props.buttonClass}
                    disabled={props.invalid}
                    onClick={(ev) => {
                        if (props.preventButton) return;
                        ev.preventDefault();
                        ev.stopPropagation();
                        runAddonAction(props, history);
                    }
                    }
                    iconClass={props.button.iconClass}
                ></Button>}
            </ListSlot>
            <ListMainSlot
                primary={url?(url + ""):undefined}
                secondary={props.title}
            >
                <div className="pageInfo">{`Page ${pages.join(",")}`}</div>
                <div className="buttonInfo">{`Button: ${props.buttonClass}`}</div>
                <div className="sourceInfo">{source}</div>
            </ListMainSlot>
            <ListSlot icon={{className: props.canDelete ? iconClasses.Edit : undefined}}/>
        </ListItem>
    )
};
export const getAddonsForDisplay = () :InternalAddonDisplayProps[] => {
    return Addons.getAllAddons().map(addon => {
        return {...addon, buttonKey: addon.key}
    })
}