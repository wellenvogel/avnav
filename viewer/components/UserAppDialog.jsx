import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import OverlayDialog, {
    DialogRow,
    promiseResolveHelper, SelectList,
    showPromiseDialog,
    useDialogContext
} from './OverlayDialog.jsx';
import Toast from './Toast.jsx';
import {Checkbox, Input, InputReadOnly, valueMissing} from './Inputs.jsx';
import Addons from './Addons.js';
import Helper, {unsetOrTrue} from '../util/helper.js';
import Requests from '../util/requests.js';
import UploadHandler from "./UploadHandler";
import {DBCancel, DBOk, DialogButtons, DialogFrame} from "./OverlayDialog";
import {IconDialog} from "./IconDialog";
import globalStore from "../util/globalstore";
import keys from "../util/keys";
import {EditDialog} from "./EditDialog";

const ItemNameDialog=({iname,resolveFunction,fixedExt,title,mandatory,checkName})=>{
    const [name,setName]=useState(iname);
    const [error,setError]=useState();
    const dialogContext=useDialogContext();
    const titlevalue=title?title:(iname?"Modify FileName":"Create FileName");
    const completeName=(nn)=>{
        if (! fixedExt) return nn;
        return nn+"."+fixedExt;
    }
    return <DialogFrame className={"itemNameDialog"} title={titlevalue}>
        <Input
            dialogRow={true}
            value={name}
            onChange={(nv)=>{
                setName(nv);
                if (checkName) {
                    setError(checkName(completeName(nv)));
                }
            }}
            mandatory={mandatory}
            checkFunction={(n)=>!checkName(completeName(n))}
            >
            {fixedExt && <span className={"ext"}>.{fixedExt}</span>}
        </Input>
        { error && <DialogRow className={"errorText"}><span className={'inputLabel'}></span>{error}</DialogRow>}
        <DialogButtons buttonList={[
            DBCancel(),
            DBOk(()=> {
                promiseResolveHelper({ok:dialogContext.closeDialog},resolveFunction,completeName(name));
            },{close:false,disabled: valueMissing(mandatory,name) || !!error})
        ]}/>
    </DialogFrame>
};
ItemNameDialog.propTypes={
    iname: PropTypes.string,
    resolveFunction: PropTypes.func, //must return true to close the dialog
    checkName: PropTypes.func, //if provided: return an error text if the name is invalid
    title: PropTypes.func, //use this as dialog title
    mandatory: PropTypes.oneOfType([PropTypes.bool,PropTypes.func]), //return true if the value is mandatory but not set
    fixedExt: PropTypes.string //set a fixed extension
}

const uploadFromEdit=async (name,data,overwrite)=>{
    try {
        await Requests.postPlain({
            request: 'upload',
            type: 'user',
            name: name,
            overwrite:overwrite
        }, data);
    }catch (e){
        Toast(e);
        throw e;
    }
}

const SelectHtmlDialog=({allowUpload,resolveFunction,current})=>{
    const dialogContext=useDialogContext();
    const [uploadSequence,setUploadSequence]=useState(0);
    const [userFiles,setUserFiles]=useState([]);
    const listFiles=(name)=>{
        Requests.getJson("?request=list&type=user")
            .then((data) => {
                let nuserFiles = [];
                if (data.items) {
                    data.items.forEach((el) => {
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
            }).catch((error) => {
        });
    }
    useEffect(() => {
        listFiles();
    }, []);
    const checkName=(name)=>{
        if (! name) return;
        for (let i=0;i<userFiles.length;i++) {
            if (userFiles[i].name ===name) return "file "+name+" already exists";
        }
    }
    return <DialogFrame title={"Select HTML file"}>
        <UploadHandler
            uploadSequence={uploadSequence}
            type={'user'}
            checkNameCallback={(name)=>{
                if (name && name.substring(name.length-4).toUpperCase() === 'HTML') {
                    let err=checkName(name);
                    if (err) return err;
                    return {name: name}
                }
                return "only files of type html allowed";
            }}
            doneCallback={(v)=>listFiles(v.param.name)}
            errorCallback={(err)=>Toast(err)}
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
                name: 'upload',
                label: 'Upload',
                onClick: ()=>{ setUploadSequence((old)=>old+1)},
                visible: (allowUpload === undefined|| allowUpload) && globalStore.getData(keys.gui.capabilities.uploadUser),
                close: false
            },
            {
                name: 'new',
                label: 'New',
                onClick: () => {
                    dialogContext.showDialog(()=><ItemNameDialog
                        iname={""}
                        fixedExt={"html"}
                        mandatory={(v)=>!v}
                        checkName={checkName}
                        resolveFunction={(name)=>{
                            if (!name) return;
                            const data = `<html>\n<head>\n</head>\n<body>\n<p>Template ${name}</p>\n</body>\n</html>`;
                            dialogContext.showDialog(() => <EditDialog
                                data={data}
                                fileName={name}
                                resolveFunction={async (modifiedData) => {
                                    await uploadFromEdit(name,modifiedData,true);
                                    listFiles(name);
                                }}
                                saveFunction={async (modifiedData)=>
                                    await uploadFromEdit(name,modifiedData,true)}
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

const TranslateUrlDialog=({resolveFunction,current})=>{
    const dialogContext=useDialogContext();
    useEffect(() => {
        (async ()=> {
            try {
                const data = await Requests.getJson("?request=list&type=user");
                if (data.items) {
                    data.items.forEach((el) => {
                        if (Helper.getExt(el.name) === 'html') {
                            if (el.url === current) {
                                dialogContext.closeDialog();
                                resolveFunction(el.name);
                            }
                        }
                    });
                }
            } catch (error) {

            }
            dialogContext.closeDialog();
        })();
    }, []);
    return <DialogFrame title={"loading..."}/>
}

const SelectExistingDialog=({existingAddons,resolveFunction})=>{
    const dialogContext=useDialogContext();
    const selist = [];
    existingAddons.forEach((addon) => {
        selist.push({value: addon, label: addon.title, icon: addon.icon});
    })
    return <DialogFrame className="selectDialog" title="Select Addon to Edit">
        <SelectList list={selist} onClick={(elem)=>{
            dialogContext.closeDialog();
            resolveFunction(elem.value);
        }}></SelectList>
        <DialogButtons buttonList={[
            {
                name:"new",
                onClick:()=>resolveFunction()
            },
            DBCancel()
        ]}/>
    </DialogFrame>
}

const checkUrl=(val,isInternal)=>{
    if (! val) return "must not be empty";
    if (isInternal){
        if (val.match(/^http/i)) return "internal urls must not start with http";
        return
    }
    if (!val.match(/^https*:\/\//i)) return "external urls must start with http[s]://";
}

const UserAppDialog = (props) => {
    const [currentAddon, setCurrentAddon] = useState({...props.addon, ...props.fixed});
    const dialogContext = useDialogContext();
    const fixed = props.fixed || {};
    const shouldFind =  ! fixed.name && ( fixed.url  && ! props.addon);
    const [loaded, setLoaded] = useState(!shouldFind);
    const [internal, setInternal] = useState(!(!shouldFind && (props.addon || {}).keepUrl));
    const fillLists = () => {
        if (!loaded) Addons.readAddOns()
            .then((addons) => {
                let current = Addons.findAddonByUrl(addons, props.fixed.url,true)
                if (current.length) {
                    showPromiseDialog(dialogContext, (props) =>
                        <SelectExistingDialog
                            {...props}
                            existingAddons={current}
                        />
                    )
                        .then((selected) => {
                            if (selected !== undefined) {
                                setCurrentAddon({...selected, ...props.fixed});
                            }
                        })
                        .catch(() => {
                        })
                }
                setLoaded(true);
            })
            .catch((error) => Toast("unable to load addons: " + error));

    }

    useEffect(() => {
        fillLists();
    }, []);
    let canEdit = unsetOrTrue(currentAddon.canDelete);
    if (!loaded) canEdit = false;
    let fixedUrl = fixed.url !== undefined;
    let title = "";
    if (canEdit) title = currentAddon.name ? "Modify " : "Create ";
    return (
        <DialogFrame className="userAppDialog" flex={true} title={title + 'User App'}>
            {(fixedUrl || !canEdit) ?
                <InputReadOnly
                    dialogRow={true}
                    className="url"
                    label="url"
                    value={currentAddon.url}/>
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
                    {!internal ?
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
                                        current={currentAddon.url}
                                    />
                                })
                            }}/>
                    }
                </React.Fragment>
            }
            {canEdit ?
                <Input
                    dialogRow={true}
                    label="title"
                    value={currentAddon.title}
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
            }
            {(canEdit)?
                <InputReadOnly
                    dialogRow={true}
                    label="icon"
                    value={currentAddon.icon}
                    mandatory={(v) => !v}
                    onClick={()=>{
                        dialogContext.showDialog(()=>{
                            return <IconDialog
                                value={currentAddon.icon}
                                onChange={(icon)=>setCurrentAddon({...currentAddon,icon:icon.url})}
                            />
                        })
                    }}
                >
                    {currentAddon.icon && <img className="appIcon" src={currentAddon.icon}/>}
                </InputReadOnly>
                :
                <InputReadOnly
                    dialogRow={true}
                    label="icon"
                    value={currentAddon.icon}
                >
                    {currentAddon.icon && <img className="appIcon" src={currentAddon.icon}/>}
                </InputReadOnly>
            }
            {canEdit && !internal && <Checkbox
                dialogRow={true}
                label={'newWindow'}
                value={currentAddon.newWindow === 'true'}
                onChange={(nv) => {
                    setCurrentAddon({...currentAddon, newWindow: nv ? 'true' : 'false'});
                }}
            />}


            <DialogButtons buttonList={[
                {
                    name: 'edit',
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
                            const data = await Requests.getHtmlOrText("", {useNavUrl:true}, {
                                request: 'download',
                                type: 'user',
                                name: name,
                                noattach: true
                            });
                            dialogContext.showDialog(() => <EditDialog
                                data={data}
                                fileName={name}
                                title={"Edit "+name}
                                saveFunction={async (mData)=> await uploadFromEdit(name,mData,true)}
                                resolveFunction={async (mData)=> await uploadFromEdit(name,mData,true)}
                            />)
                        }catch (e){
                            if (e) Toast(e);
                        }
                    },
                    visible: !!currentAddon.url && Helper.startsWith(currentAddon.url,"/user/viewer") && currentAddon.canDelete && canEdit && internal
                },
                {
                    name: 'delete',
                    label: 'Delete',
                    onClick: () => {
                        dialogContext.showDialog(OverlayDialog.createConfirmDialog("really delete User App?",
                            () => {
                                Addons.removeAddon(currentAddon.name)
                                    .then((data) => {
                                        props.resolveFunction(data);
                                        dialogContext.closeDialog();
                                    })
                                    .catch((error) => {
                                        if (unsetOrTrue(props.showToasts)) Toast("unable to remove: " + error);
                                    });
                            }
                        ));
                    },
                    close: false,
                    visible: !!(currentAddon.name && currentAddon.canDelete && canEdit)
                },
                DBCancel(),
                DBOk(() => {
                        const addon={...currentAddon, ...props.fixed};
                        Addons.updateAddon(addon.name, addon.url, addon.icon, addon.title, addon.newWindow)
                            .then((data) => {
                                props.resolveFunction(data);
                                dialogContext.closeDialog();
                        })
                        .catch((error) => {
                            if (unsetOrTrue(props.showToasts)) Toast("unable to add/update: " + error);
                        });

                    },
                    {
                        disabled: !currentAddon.icon || !currentAddon.url || !canEdit || checkUrl(currentAddon.url,internal) !== undefined,
                        close:false})
            ]}/>
        </DialogFrame>
    );
}

UserAppDialog.propTypes = {
    fixed: PropTypes.object.isRequired,
    addon: PropTypes.object,
    resolveFunction: PropTypes.func
};

export default UserAppDialog;