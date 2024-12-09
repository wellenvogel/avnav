import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import OverlayDialog, {useDialogContext} from './OverlayDialog.jsx';
import Toast from './Toast.jsx';
import {Checkbox,Input,InputReadOnly,InputSelect} from './Inputs.jsx';
import Addons from './Addons.js';
import Helper from '../util/helper.js';
import Requests from '../util/requests.js';
import GuiHelpers from '../util/GuiHelpers.js';
import UploadHandler from "./UploadHandler";
import {DBCancel, DBOk, DialogButtons, DialogFrame} from "./OverlayDialog";
import {IconDialog} from "./IconDialog";

const contains = (list, url, opt_key) => {
    if (opt_key === undefined) opt_key = "url";
    for (let k = 0; k < list.length; k++) {
        if (list[k][opt_key] === url) return true;
    }
    return false;
}
const UserAppDialog = (props) => {
    const [currentAddon, setCurrentAddon] = useState({...props.addon, ...props.fixed});
    const dialogContext = useDialogContext();
    const [userFiles, setUserFiles] = useState([]);
    const initiallyLoaded = (props.fixed || {}).url === undefined || props.addon !== undefined;
    const [loaded, setLoaded] = useState(initiallyLoaded);
    const [internal, setInternal] = useState(!(initiallyLoaded && (props.addon || {}).keepUrl));

    const fillLists = () => {
        Requests.getJson("?request=list&type=user")
            .then((data) => {
                let nuserFiles = [];
                if (data.items) {
                    data.items.forEach((el) => {
                        if (Helper.getExt(el.name) === 'html') {
                            el.label = el.url;
                            el.value = el.url;
                            nuserFiles.push(el);
                        }
                    });
                    setUserFiles(nuserFiles)
                }
            }).catch((error) => {
        });
        if (!loaded) Addons.readAddOns()
            .then((addons) => {
                let current = Addons.findAddonByUrl(addons, props.fixed.url)
                if (current) setCurrentAddon({...current, ...props.fixed});
                setLoaded(true);
            })
            .catch((error) => Toast("unable to load addons: " + error));

    }

    useEffect(() => {
        fillLists();
    }, []);
    let fixed = props.fixed || {};
    let canEdit = (currentAddon.canDelete === undefined || currentAddon.canDelete);
    if (!loaded) canEdit = false;
    let fixedUrl = fixed.url !== undefined;
    let title = "";
    if (canEdit) title = fixed.name ? "Modify " : "Create ";
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
                            onChange={(val) => setCurrentAddon({...currentAddon, url: val})}/>
                        :
                        <InputSelect
                            dialogRow={true}
                            label="internal url"
                            value={currentAddon.url}
                            mandatory={(v) => !v}
                            list={userFiles}
                            showDialogFunction={dialogContext.showDialog}
                            onChange={(selected) => setCurrentAddon({...currentAddon, url: selected.url})}/>
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
                    name: 'delete',
                    label: 'Delete',
                    onClick: () => {
                        dialogContext.showDialog(OverlayDialog.createConfirmDialog("really delete User App?",
                            () => {
                                dialogContext.closeDialog();
                                props.removeFunction(currentAddon.name);
                            }
                        ));
                    },
                    close: false,
                    visible: !!(currentAddon.name && currentAddon.canDelete && canEdit)
                },
                DBCancel(),
                DBOk(() => {
                        props.okFunction({...currentAddon, ...props.fixed});
                    },
                    {disabled: !currentAddon.icon || !currentAddon.url || !canEdit})
            ]}/>
        </DialogFrame>
    );
}

UserAppDialog.propTypes = {
    fixed: PropTypes.object.isRequired,
    addon: PropTypes.object,
    closeCallback: PropTypes.func.isRequired,
    okFunction: PropTypes.func.isRequired,
    removeFunction: PropTypes.func.isRequired
};

UserAppDialog.showUserAppDialog = (item, fixed, opt_showToasts) => {
    return new Promise((resolve, reject) => {
        if (!item && !(fixed || {}).url) {
            let err = "either addon or fixed.url required";
            if (opt_showToasts) Toast(err);
            reject(err);
        }
        OverlayDialog.dialog((props) => {
            return (
                <UserAppDialog
                    {...props}
                    okFunction={(addon) => {
                        Addons.updateAddon(addon.name, addon.url, addon.icon, addon.title, addon.newWindow)
                            .then((data) => {
                                resolve(data)
                            })
                            .catch((error) => {
                                if (opt_showToasts) Toast("unable to add/update: " + error);
                                reject(error);
                            });
                    }}
                    removeFunction={(name) => {
                        Addons.removeAddon(name)
                            .then((data) => resolve(data))
                            .catch((error) => {
                                if (opt_showToasts) Toast("unable to remove: " + error);
                                reject(error);
                            });
                    }}
                    //TODO: item vs addon
                    addon={item}
                    fixed={fixed}
                />
            )
        })
    });
};

export default UserAppDialog;