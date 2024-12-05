import React, {useState} from 'react';
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
    const [iconList, setIconList] = useState([]);
    const [userFiles, setUserFiles] = useState([]);
    const initiallyLoaded = (props.fixed || {}).url === undefined || props.addon !== undefined;
    const [loaded, setLoaded] = useState(initiallyLoaded);
    const [internal, setInternal] = useState(!(initiallyLoaded && (props.addon || {}).keepUrl));
    const [uploadSequence, setUploadSequence] = useState(0);

    const readImages = (opt_active) => {
        Requests.getJson("?request=list&type=images")
            .then((data) => {
                let itemList = [];
                let activeUrl;
                if (data.items) {
                    data.items.forEach((el) => {
                        if (GuiHelpers.IMAGES.indexOf(Helper.getExt(el.name)) >= 0) {
                            if (!contains(iconList, el.url)) {
                                el.label = el.url;
                                el.value = el.url;
                                itemList.push(el);
                            }
                            if (opt_active !== undefined && el.name === opt_active) {
                                activeUrl = el.url;
                            }
                        }
                    });
                    setIconList((prevState) => {
                        return prevState.concat(itemList);
                    });
                }
                if (activeUrl !== undefined) {
                    setCurrentAddon({...currentAddon, icon: activeUrl})
                }
            })
            .catch((error) => {
            })
    }
    const fillLists = () => {
        Requests.getJson("?request=list&type=user")
            .then((data) => {
                let niconList = [];
                let nuserFiles = [];
                if (data.items) {
                    data.items.forEach((el) => {
                        if (GuiHelpers.IMAGES.indexOf(Helper.getExt(el.name)) >= 0) {
                            if (!contains(iconList, el.url)) {
                                el.label = el.url;
                                el.value = el.url;
                                niconList.push(el);
                            }
                        }
                        if (Helper.getExt(el.name) === 'html') {
                            el.label = el.url;
                            el.value = el.url;
                            nuserFiles.push(el);
                        }
                    });
                    setIconList((prevList) => prevList.concat(niconList));
                    setUserFiles(nuserFiles)
                }
            }).catch((error) => {
        });
        readImages();
        if (!loaded) Addons.readAddOns()
            .then((addons) => {
                let current = Addons.findAddonByUrl(addons, props.fixed.url)
                if (current) setCurrentAddon({...current, ...props.fixed});
                setLoaded(true);
            })
            .catch((error) => Toast("unable to load addons: " + error));

    }

    fillLists();
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
                    <UploadHandler
                        local={false}
                        type={'images'}
                        doneCallback={(param) => {
                            readImages(param.param.name);
                        }}
                        errorCallback={(err) => {
                            if (err) Toast(err);
                        }}
                        uploadSequence={uploadSequence}
                        checkNameCallback={(name) => {
                            return new Promise((resolve, reject) => {
                                if (contains(iconList, name, "name")) {
                                    reject(name + " already exists");
                                    return;
                                }
                                let ext = Helper.getExt(name);
                                let rt = {name: name};
                                if (GuiHelpers.IMAGES.indexOf(ext) < 0) {
                                    reject("only images of types " + GuiHelpers.IMAGES.join(","));
                                    return;
                                }
                                resolve(rt);
                            });
                        }}
                    />
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
            {canEdit ?
                <InputSelect
                    dialogRow={true}
                    label="icon"
                    value={currentAddon.icon}
                    list={[{label: '--upload new--', value: undefined, upload: true}].concat(iconList)}
                    showDialogFunction={dialogContext.showDialog}
                    mandatory={(v) => !v}
                    onChange={(selected) => {
                        if (selected.upload) {
                            setUploadSequence((uploadSequence) => uploadSequence + 1);
                            return;
                        }
                        setCurrentAddon({...currentAddon, icon: selected.url});
                    }}
                >
                    {currentAddon.icon && <img className="appIcon" src={currentAddon.icon}/>}
                </InputSelect>
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