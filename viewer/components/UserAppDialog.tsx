import React, {useEffect, useState} from 'react';
import {showPromiseDialog} from './OverlayDialog';
import Toast from './Toast';
import {Checkbox, Input, InputReadOnly, InputSelect} from './Inputs';
import Addons, {InternalAddonProps, ServerAddon} from '../util/Addons';
import Helper, {unsetOrTrue} from '../util/helper';
import Requests from '../util/requests';
import UploadHandler, {uploadClick} from "./UploadHandler";
import {DBCancel, DBOk, DialogButtons, DialogFrame} from "./OverlayDialog";
// @ts-ignore
import {IconDialog} from "./IconDialog";
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
import {SelectListEntry} from "../util/EditableParameter";
import {getPageTitle, PAGEIDS, PageType, PLUGINPAGES} from "../util/pageids";
import {Icon} from "./Icons";
import ButtonDefs from "./ButtonDefs";

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
const UserAppDialog = (props:UserAppDialogProps) => {
    const [currentAddon, setCurrentAddon] = useState<InternalAddonProps>({...props.addon, ...props.fixed});
    const [currentIcon,setCurrentIcon]=useState<string|URL>(props.addon?.button?.icon);
    const dialogContext = useDialogContext();
    const fixed:UserAppDialogFixed = props.fixed || {};
    const shouldFind =  ! fixed.name && ( fixed.url  && ! props.addon);
    const [loaded, setLoaded] = useState(!shouldFind);
    const [internal, setInternal] = useState(!(!shouldFind && (props.addon || {}).keepUrl));
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
                            setCurrentAddon({...selected, ...props.fixed});
                            setCurrentIcon(selected.button?.icon);
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
    const fixedUrl = fixed.url !== undefined;
    let title = "";
    if (canEdit) title = currentAddon.name ? "Modify " : "Create ";
    const showUrl=!!currentAddon.url || canEdit;
    const showTitle=!!currentAddon.title || canEdit;
    const displayPage=Array.isArray(currentAddon.page) ? currentAddon.page.join(",") : currentAddon.page||PAGEIDS.ADDON;
    return (
        <DialogFrame className="userAppDialog" flex={true} title={title + 'User App'}>
            {(fixedUrl || !canEdit) ?
                (showUrl?
                <InputReadOnly
                    dialogRow={true}
                    className="url"
                    label="url"
                    value={currentAddon.url}/>
                :null
                )
                :
                <React.Fragment>
                    {(canEdit && !fixedUrl) && <Checkbox
                        dialogRow={true}
                        label="internal"
                        value={internal}
                        onChange={(nv) => {
                            setInternal(nv);
                            setCurrentAddon({...currentAddon, url: undefined, newWindow: false});
                        }
                        }/>}
                    {showUrl && (!internal ?
                        <Input
                            dialogRow={true}
                            label="external url"
                            value={currentAddon.url}
                            minSize={50}
                            maxSize={100}
                            mandatory={(v) => !v}
                            checkFunction={(v)=>checkUrl(v,false) === undefined}
                            onChange={(val) => setCurrentAddon({...currentAddon, url: val})}/>
                        :
                        <InputReadOnly
                            dialogRow={true}
                            label="internal url"
                            value={currentAddon.url}
                            mandatory={(v) => !v}
                            onClick={()=>{
                                dialogContext.showDialog(()=>{
                                    return <SelectHtmlDialog
                                        resolveFunction={(url)=>
                                            setCurrentAddon({...currentAddon,url:url})
                                        }
                                        current={currentAddon.url+""}
                                    />
                                })
                            }}/>
                    )
                    }
                </React.Fragment>
            }
            {showTitle && (canEdit ?
                <Input
                    dialogRow={true}
                    label="title"
                    value={currentAddon.title?currentAddon.title:""}
                    minSize={50}
                    maxSize={100}
                    onChange={(value) => {
                        setCurrentAddon({...currentAddon, title: value})
                    }}
                />
                :
                <InputReadOnly
                    dialogRow={true}
                    label="title"
                    value={currentAddon.title}
                />
            )
            }
            {(canEdit)?
                <InputReadOnly
                    dialogRow={true}
                    label="icon"
                    value={currentIcon}
                    mandatory={(v) => !v}
                    onClick={()=>{
                        dialogContext.showDialog(()=>{
                            return <IconDialog
                                value={currentIcon}
                                onChange={(icon:{url:string})=>setCurrentIcon(icon.url)}
                            />
                        })
                    }}
                >
                    {currentIcon && <Icon icon={currentIcon+""}/>}
                </InputReadOnly>
                :
                <InputReadOnly
                    dialogRow={true}
                    label="icon"
                    value={currentIcon+""}
                >
                    {currentIcon && <Icon icon={currentIcon+""}/>}
                </InputReadOnly>
            }
            {canEdit? <InputSelect
                dialogRow={true}
                label="page"
                list={Object.values(PLUGINPAGES).map((page)=>{
                    const label=getPageLabel(page);
                    return {label:label,value:page}
                })}
                onChange={(nv)=>setCurrentAddon({...currentAddon, page:nv.value})}
                value={{value:displayPage,label: getPageLabel(displayPage)}}/>
                :
                <InputReadOnly
                dialogRow={true}
                label="page"
                value={getPageLabel(displayPage)}
                />
            }
            {canEdit && !internal && <Checkbox
                dialogRow={true}
                label={'newWindow'}
                value={currentAddon.newWindow}
                onChange={(nv) => {
                    setCurrentAddon({...currentAddon, newWindow: nv});
                }}
            />}
            <InputReadOnly dialogRow={true}
                           label="Button"
                           value={currentAddon.buttonClass}
            >

            </InputReadOnly>


            <DialogButtons buttonList={[
                {
                    ...ButtonDefs.Edit,
                    close: false,
                    onClick:async ()=>{
                        let name;
                        try {
                            name = await showPromiseDialog(dialogContext, TranslateUrlDialog, {current: currentAddon.url});
                        }catch (e) {
                            Toast("unable to find file for "+currentAddon.url);
                            return;
                        }
                        try{
                            const data = await Requests.getHtmlOrText({
                                request:'api',
                                command: 'download',
                                type: 'user',
                                name: name,
                                noattach: true
                            });
                            dialogContext.showDialog(() => <EditDialog
                                data={data}
                                fileName={name}
                                title={"Edit "+name}
                                saveFunction={async (mData)=> await uploadFromEdit(name,mData,true,'user')}
                                resolveFunction={async (mData)=> await uploadFromEdit(name,mData,true,'user')}
                            />)
                        }catch (e){
                            if (e) Toast(e);
                        }
                    },
                    visible: !!currentAddon.url && Helper.startsWith(currentAddon.url+"","/user/viewer") && currentAddon.canDelete && canEdit && internal
                },
                {
                    ...ButtonDefs.DBDelete,
                    onClick: () => {
                        showPromiseDialog(dialogContext,(dprops)=><ConfirmDialog {...dprops} text={"really delete User App?"}/>)
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
                        ,()=>{});
                    },
                    close: false,
                    visible: !!(currentAddon.name && currentAddon.canDelete && canEdit)
                },
                DBCancel(),
                DBOk(() => {
                        const addon={...currentAddon, ...props.fixed};
                        let title:string
                        if (typeof addon.title === 'string') {
                            if (addon.title) title=addon.title; //avoid empty/null title
                        }
                        Addons.updateAddon(addon.name, addon.url,
                            currentIcon, title, addon.newWindow,
                            Array.isArray(addon.page)?addon.page[0]:addon.page)
                            .then(() => {
                                props.resolveFunction();
                                dialogContext.closeDialog();
                        })
                        .catch((error) => {
                            if (unsetOrTrue(props.showToasts)) Toast("unable to add/update: " + error);
                        });

                    },
                    {
                        disabled: !currentIcon || !currentAddon.url || !canEdit || checkUrl(currentAddon.url,internal) !== undefined,
                        close:false})
            ]}/>
        </DialogFrame>
    );
}

export default UserAppDialog;