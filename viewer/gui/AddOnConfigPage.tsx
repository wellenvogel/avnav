/**
 * Created by andreas on 02.05.14.
 */

import {ButtonDef, updateButtons} from '../components/Button';
import ItemList from '../components/ItemList';
import React, {useRef, useState} from 'react';
import {PageFrame, PageLeft, PageProps} from '../components/Page';
import {AddonProps} from '../util/Addons';
import UserAppDialog, {AddonItem, getAddonsForDisplay} from '../components/UserAppDialog';
import {showPromiseDialog} from "../components/OverlayDialog";
import {avitem} from "../util/helper";
import {useHistory} from "../components/HistoryProvider";
import {InjectMainMenu, useInitialButton} from "./MainNav";
import {getPageTitle, PAGEIDS} from "../util/pageids";
import AddOnConfigPageButtons from "./AddOnConfigPageButtons";
import {MultiView, MvHeadline, useScrollHelper} from "../components/MultiView";
import ButtonList from "../components/ButtonList";
import {useStoreState} from "../hoc/Dynamic";
import keys from "../util/keys";
import {useUploadHelper} from "../components/UploadHandler";
import {DownloadItemList, UploadAction} from "../components/DownloadItemList";
import {useStoreHelper} from "../util/UiHelper";
import ButtonDefs from "../components/ButtonDefs";


export const AddonConfigPage = (props: PageProps) => {
    useStoreState(keys.gui.global.reloadSequence);
    const [selectedItem,setSelectedItem]=useState<string>();
    const [connected] = useStoreState(keys.gui.global.connectedMode);
    const [uploadImages]=useStoreState(keys.gui.capabilities.uploadImages);
    const [uploadUser]=useStoreState(keys.gui.capabilities.uploadUser);
    const history = useHistory();
    const [addons, setAddons] = React.useState(getAddonsForDisplay());
    const [scrollProps, scrollTo, visible] = useScrollHelper(0);
    const [uploadPropsUser, uploadActionUser] = useUploadHelper('user');
    const [uploadPropsImages, uploadActionImages] = useUploadHelper('images');
    useStoreHelper(()=>readAddons(),keys.gui.global.addonsChanged);
    const numViews = 3;
    const currentButtons = useRef<ButtonDef[]>();
    const buttonActions = {
        [ButtonDefs.AddonConfigPlus.name]: {
            onClick: () => {
                showPromiseDialog(undefined, UserAppDialog)
                    .then(() => readAddons())
                    .catch(() => readAddons());
            }

        },
        Cancel: {
            onClick: () => {
                history.pop()
            }
        },
        [ButtonDefs.AddonConfigAddOns.name]: {
            toggle: visible(0),
            disabled: props.pageColumns >= numViews,
            onClick: () => {
                scrollTo(0);
            }
        },
        [ButtonDefs.AddonConfigUser.name]: {
            onClick: () => {
                scrollTo(1);
            },
            toggle: visible(1),
            disabled: props.pageColumns >= numViews,
        },
        [ButtonDefs.AddonConfigImages.name]: {
            onClick: () => {
                scrollTo(2);
            },
            toggle: visible(2),
            disabled: props.pageColumns >= numViews,
        }
    }

    const readAddons = () => {
        setAddons(getAddonsForDisplay());
    }

    const buttons = InjectMainMenu(PAGEIDS.ADDCFG, updateButtons(AddOnConfigPageButtons, buttonActions));
    currentButtons.current = buttons;
    useInitialButton(currentButtons);
    const PAGE=PAGEIDS.ADDCFG;
    return <PageFrame id={PAGE}>
        <PageLeft id={PAGE} title={getPageTitle(PAGE)}>
            <MultiView
                {...scrollProps}
                maxNumber={props.pageColumns}
                views={[
                    <React.Fragment key="0">
                        <MvHeadline title={"Configure"}></MvHeadline>
                        <ItemList
                            selectedKey={selectedItem}
                            className="addonItems"
                            scrollable={true}
                            itemList={addons}
                            itemClass={AddonItem}
                            onItemClick={(ev) => {
                                const item: AddonProps = avitem(ev);
                                setSelectedItem(item.key||item.name);
                                showPromiseDialog(undefined, (props) =>
                                    <UserAppDialog {...props}
                                                   addon={{...item, canDelete: item.canDelete && connected}}/>
                                )
                                    .then(() => readAddons())
                                    .catch(() => readAddons());
                            }}
                        />
                    </React.Fragment>
                    ,
                    <React.Fragment key="1">
                        <MvHeadline title={"User Files"}/>
                        <UploadAction
                            disabled={!connected || ! uploadUser}
                            onClick={uploadActionUser}
                            title={'User File'}></UploadAction>
                        <DownloadItemList
                            {...uploadPropsUser}
                            showCreate={true}
                            type={'user'}
                            autoreload={3000}
                            scrollSelected={1}
                            //selectedName={}
                        />
                    </React.Fragment>
                    ,
                    <React.Fragment key="2">
                        <MvHeadline title={"Image Files"}/>
                        <UploadAction
                            disabled={!connected || ! uploadImages}
                            onClick={uploadActionImages}
                            title={'Image'}></UploadAction>
                        <DownloadItemList
                            {...uploadPropsImages}
                            type={'images'}
                            autoreload={3000}
                            scrollSelected={1}
                            //selectedName={}
                        />
                    </React.Fragment>

                ]}/>
        </PageLeft>
        <ButtonList page={PAGE} itemList={currentButtons.current}/>
    </PageFrame>
}

export default AddonConfigPage;