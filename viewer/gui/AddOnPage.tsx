/**
 * Created by andreas on 02.05.14.
 */

import {useStoreState} from '../hoc/Dynamic';
import globalStore from '../util/globalstore';
import globalstore from '../util/globalstore';
import keys from '../util/keys';
import React, {useCallback, useEffect, useRef} from 'react';
import {PageFrame, PageLeft, PageProps} from '../components/Page';
import remotechannel, {COMMANDS} from "../util/remotechannel";
import {handleInitialButton, InjectMainMenu} from "./MainNav";
import {getPageTitle, PAGEIDS} from "../util/pageids";
import {ButtonAddonType, ButtonDef, ButtonEvent, DynamicButtonProps, updateButtons} from "../components/Button";
import {useHistory} from "../components/HistoryProvider";
import AddOnPageButtons from "./AddOnPageButtons";
import keyhandler from "../util/keyhandler";
import ButtonList from "../components/ButtonList";
import {addonViewManager} from "../components/AddonView";

const PAGE=PAGEIDS.ADDON;
export interface AddOnPageProps extends Partial<PageProps> {}
export const AddOnPage =(props:AddOnPageProps) :React.ReactNode => {
    useStoreState(keys.gui.global.reloadSequence);
    useStoreState(keys.gui.global.addonsChanged);
    const history=useHistory();
    const currentButtons=useRef<ButtonDef[]>(null);
    const showApp = useCallback(() => {
        if (!currentButtons.current) return;
        const last = globalStore.getData(keys.gui.addonpage.activeAddOn);
        if (last) {
            if (addonViewManager.hasPageAddon(props.id, last)) return;
            for (const button of currentButtons.current) {
                if (button.name === last && button.isAddon === ButtonAddonType.CONFIG) {
                    keyhandler.callHandler('button', last);
                    return;
                }
            }
        }
        //no addon select - trigger the first button
        for (const button of currentButtons.current) {
            if (button.isAddon !== ButtonAddonType.CONFIG) continue;
            if (button.name && button.onClick) {
                keyhandler.callHandler('button', button.name);
                break;
            }
        }
    }, [])
        const buttonActions:Record<string,Partial<DynamicButtonProps>> = {
            Back: {
                onClick: () => {
                    if (! globalstore.getData(keys.gui.global.addonFrameVisible)) return;
                    window.history.back();
                }
            },
            Cancel: {
                onClick: () => {
                    history.pop()
                }
            }
        }
    const buttons=InjectMainMenu(
        PAGE,
        updateButtons(AddOnPageButtons,buttonActions),
        showApp,
        );
    const finalButtons:ButtonDef[]=[];
    for (const button of buttons){
        if (buttonActions[button.name]){
            finalButtons.push(button);
            continue;
        }
        if (button.onClick && (button.isAddon !== ButtonAddonType.NONE && button.isAddon !== undefined)) {
            const original=button.onClick;
            const modifiedButton=button.copy({onClick:(ev:ButtonEvent) =>{
                globalStore.storeData(keys.gui.addonpage.activeAddOn,button.name);
                remotechannel.sendMessage(COMMANDS.addOn,button.name);
                original(ev);
            }});
            finalButtons.push(modifiedButton);
        }
        else {
            finalButtons.push(button);
        }
    }
    currentButtons.current=finalButtons;

    useEffect(() => {
        const remoteToken=remotechannel.subscribe(COMMANDS.addOn,(addon:string)=>{
            keyhandler.callHandler('button',addon);
        })
        if (currentButtons.current) {
            if (!handleInitialButton(history)) {
                showApp();
            }
        }
        return ()=>{
            remotechannel.unsubscribe(remoteToken);
        }
    }, []);

    return <PageFrame
        {...props}
        id={PAGE}
        >
        <PageLeft
            id={props.id}
            title={getPageTitle(PAGE)}>
            <div className="emptyPage">
                No USer App Selected
            </div>
        </PageLeft>
        <ButtonList page={PAGE} itemList={finalButtons} />
    </PageFrame>
}

export default AddOnPage;