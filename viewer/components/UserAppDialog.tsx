import React, {SyntheticEvent, useEffect, useState} from 'react';
import {showPromiseDialog} from './OverlayDialog';
import Toast from './Toast';

import Addons, {InternalAddonProps, ServerAddon} from '../util/Addons';
import Helper, {getav, unsetOrTrue} from '../util/helper';
import Requests from '../util/requests';
import UploadHandler, {uploadClick} from "./UploadHandler";
import {DBCancel, DBOk, DialogButtons, DialogFrame} from "./OverlayDialog";
import globalStore from "../util/globalstore";
import keys from "../util/keys";
import {EditDialog, EditDialogWithSave, getTemplate, uploadFromEdit} from "./EditDialog";
import {ConfirmDialog, SelectList} from "./BasicDialogs";
// @ts-ignore
import {checkName, ItemNameDialog} from "./ItemNameDialog";
// @ts-ignore
import {createItemActions} from "./FileDialog";
import {useDialogContext} from "./DialogContext";
import {Item} from "../util/itemFunctions";
import { SelectListEntry} from "../util/EditableParameter";
import {EditableBooleanParameterUI, EditableStringParameterUI,
    EditableCustomDialogUI,EditableIconParameterUI,
    // @ts-ignore
    EditableSelectParameterUI} from "./EditableParameterUI";
import {getPageTitle, PAGEIDS, PageType, PLUGINPAGES} from "../util/pageids";
import ButtonDefs from "./ButtonDefs";
import {ParameterDialog, ParameterType} from "./ParameterDialog";
import {WidgetParameterValue} from "../api/api.interface";
import base from "../base";

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
                        mandatory={(v:boolean)=>!v}
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
    existingAddons:InternalAddonProps[],
    resolveFunction:(addon?:ServerAddon) => void
}
const SelectExistingDialog=({existingAddons,resolveFunction}:SelectExistingDialogProps)=>{
    const dialogContext=useDialogContext();
    const selist:SelectListEntry[] = [];
    existingAddons.forEach((addon) => {
        selist.push({value: addon, label: addon.title+"", icon: addon.button?.icon});
    })
    return <DialogFrame className="selectDialog" title="Select Addon to Edit">
        <SelectList list={selist} onClick={(elem)=>{
            dialogContext.closeDialog();
            resolveFunction(elem.value);
        }}></SelectList>
        <DialogButtons buttonList={[
            {
                ...ButtonDefs.DBNew,
                onClick:()=>resolveFunction()
            },
            DBCancel()
        ]}/>
    </DialogFrame>
}

const checkUrl=(val:string|URL,isInternal?:boolean)=>{
    if (! val) return "must not be empty";
    if (isInternal){
        if ((val+"").match(/^http/i)) return "internal urls must not start with http";
        return
    }
    if (!(val+"").match(/^https*:\/\//i)) return "external urls must start with http[s]://";
}
export interface UserAppDialogFixed{
    name?:string,
    url?:string|URL
}
export interface UserAppDialogProps{
    showToasts?:boolean ;
    addon?:InternalAddonProps,
    fixed?:UserAppDialogFixed,
    resolveFunction?:() => void
}
const getPageLabel=(page:PageType)=>{
    return `${page} [${getPageTitle(page)}]`
}

interface AppDialogValues{
    [key:string]:WidgetParameterValue,
    internalUrl?: string,
    externalUrl?: string,
    fixedUrl?: string,
    name:string,
    fixedName?:string,
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
        rt.push(new EditableStringParameterUI({
            name: 'fixedUrl',
            displayName:'url',
            readOnly: true,
            description: 'The url of this user app. Cannot be changed in this mode',
            condition: {fixedUrl:(_values:any,v:any)=>!!v}
        }))
        rt.push(new EditableBooleanParameterUI({
            name: 'internal',
            readOnly: !canEdit,
            defaultValue: true,
            displayName: 'internal',
            description: 'If checked you can select a HTML page from the AvNav user files to be shown as user app. If unchecked you can select an external URL.',
            condition:{fixedUrl:(_values:any,v:any)=>!v}
        }))
        rt.push(new EditableStringParameterUI({
            name: 'externalUrl',
            displayName: 'external url',
            readOnly: !canEdit,
            condition: {internal: false,fixedUrl:(_values:any,v:any)=>!v},
            checker: (value: string) => checkUrl(value, true),
            mandatory: true,
            description: 'An external URL. The URL must start with http[s]. You can use $HOST in the url to let AvNav replace this with the IP of the AvNav server dynamically.',
        }));
        rt.push(new EditableCustomDialogUI({
            name: 'internalUrl',
            displayName: 'internal url',
            readOnly: !canEdit,
            condition: {internal: true,fixedUrl:(_values:any,v:any)=>!v},
            checker: (value: string) => checkUrl(value, false),
            mandatory: true,
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
            mandatory: true,
        }))
        rt.push(new EditableStringParameterUI({
            name:'title',
            displayName:'title',
            readOnly: !canEdit,
            condition: {title: (_values:any,v:any)=>canEdit || !!v,
                newWindow:(_values:any,v:any)=>!Helper.unsetorTrue(v)},
            description:'If set AvNav will show a title bar wit this text'
        }))
        rt.push(new EditableBooleanParameterUI({
            name:'newWindow',
            displayName:'newWindow',
            readOnly: !canEdit,
            condition:{internal:false},
            description:'If set the user app will be shown outside of AvNav in a new window',
        }))
        rt.push(new EditableSelectParameterUI({
            name:'displayPage',
            displayName:'page',
            readOnly: !canEdit,
            defaultValue:PAGEIDS.ADDON,
            list:Object.values(PLUGINPAGES).map((page)=>{
                    const label=getPageLabel(page);
                    return {label:label,value:page}
                }),
            condition:{newWindow:false},
            description:'The page in AvNav to show this user app'
        }))
        rt.push(new EditableStringParameterUI({
            name:'shortText',
            displayName:'shortText',
            readOnly: !canEdit,
            description: 'The short text to be shown on the button'
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

const addonToParam=(addon:InternalAddonProps,fixed?:UserAppDialogFixed)=>{
    const merged:InternalAddonProps={...addon, ...fixed};
    const rt:AppDialogValues= {
        internal: !hasExternalUrl(merged),
        modify: !!merged.name,
        name:merged.name,
    }
    if (rt.internal) rt.internalUrl=(merged.originalUrl||merged.url) as string;
    else rt.externalUrl=(merged.originalUrl || merged.url) as string;
    rt.title=merged.title+"";
    rt.fixedName=fixed?.name;
    rt.fixedUrl=fixed?.url as string;
    rt.icon=merged.button?.icon as string;
    rt.displayPage=(Array.isArray(merged.page)?merged.page[0]:merged.page) as string;
    rt.shortText=merged.shortText as string;
    rt.longText=merged.longText as string;
    rt.buttonClass=merged.buttonClass as string;
    rt.canDelete=merged.canDelete;
    return rt;
}


const UserAppDialog = (props:UserAppDialogProps) => {
    const [currentAddon, setCurrentAddon] = useState<AppDialogValues>(()=>addonToParam(props.addon,props.fixed));
    const dialogContext = useDialogContext();
    const fixed:UserAppDialogFixed = props.fixed || {};
    const shouldFind =  ! fixed.name && ( fixed.url  && ! props.addon);
    const [loaded, setLoaded] = useState(!shouldFind);
    const fillLists = () => {
        if (!loaded) {
            const current = Addons.findAddonByUrl(props.fixed.url)
            if (current.length) {
                showPromiseDialog(dialogContext, (dprops) =>
                    <SelectExistingDialog
                        {...dprops}
                        existingAddons={current}
                    />
                )
                    .then((selected) => {
                        if (selected !== undefined) {
                            setCurrentAddon(addonToParam(selected, props.fixed));

                        }
                    })
                    .catch(() => {
                    })
            }
            setLoaded(true);

        }
    }
    useEffect(() => {
        fillLists();
    }, []);
    let canEdit = unsetOrTrue(currentAddon.canDelete);
    if (!loaded) canEdit = false;
    let title = "";
    if (canEdit) title = currentAddon.name ? "Modify " : "Create ";
    const parameters = buildDialogParameters(canEdit);
    return <ParameterDialog
        title={title + 'User Apps'}
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
                visible: !!(currentAddon.name && currentAddon.canDelete && canEdit)
            },
            DBCancel(),
            DBOk((ev: SyntheticEvent) => {
                    const current: AppDialogValues = getav(ev).currentValues;
                    const name = props.fixed?.name || current.name;
                    const url = props.fixed?.url || current.internal ? current.internalUrl : current.externalUrl;
                    const icon = current.icon;
                    const newWindow = current.newWindow;
                    const page = current.displayPage;
                    const title = current.title || '';

                    Addons.updateAddon(name, url,
                        icon, title, newWindow,
                        page)
                        .then(() => {
                            props.resolveFunction();
                            dialogContext.closeDialog();
                        })
                        .catch((error) => {
                            if (unsetOrTrue(props.showToasts)) Toast("unable to add/update: " + error);
                        });

                }
            )
        ]}
    />

}

export default UserAppDialog;