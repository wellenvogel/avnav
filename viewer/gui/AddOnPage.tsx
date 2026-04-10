/**
 * Created by andreas on 02.05.14.
 */

import {useStoreState} from '../hoc/Dynamic';
import globalStore from '../util/globalstore';
import keys from '../util/keys';
import React, {useEffect, useRef} from 'react';
import {PageFrame, PageLeft, PageProps} from '../components/Page';
import remotechannel, {COMMANDS} from "../util/remotechannel";
import {handleInitialButton, InjectMainMenu} from "./MainNav";
import {PAGE_TITLES, PAGEIDS} from "../util/pageids";
import {ButtonDef, ButtonEvent, DynamicButtonProps, updateButtons} from "../components/Button";
import {useHistory} from "../components/HistoryProvider";
import AddOnPageButtons from "./AddOnPageButtons";
import keyhandler from "../util/keyhandler";
import ButtonList from "../components/ButtonList";
import base from "../base";

const PAGE=PAGEIDS.ADDON;
export interface AddOnPageProps extends Partial<PageProps> {}
export const AddOnPage =(props:AddOnPageProps) :React.ReactNode => {
    useStoreState(keys.gui.global.reloadSequence);
    useStoreState(keys.gui.global.addonsChanged);
    const history=useHistory();
    base.log("AddOnPage render",props);
        const buttonActions:Record<string,Partial<DynamicButtonProps>> = {
            Back: {
                onClick: () => {
                    window.history.back();
                }
            },
            Cancel: {
                onClick: () => {
                    history.pop()
                }
            }
        }
    const buttons=InjectMainMenu(PAGE,updateButtons(AddOnPageButtons,buttonActions));
    const finalButtons:ButtonDef[]=[];
    for (const button of buttons){
        if (buttonActions[button.name]){
            finalButtons.push(button);
            continue;
        }
        if (button.onClick && button.isAddon) {
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
    const currentButtons=useRef<ButtonDef[]>(null);
    currentButtons.current=finalButtons;
    useEffect(() => {
        base.log(PAGE,"handleInitialButton")
        const remoteToken=remotechannel.subscribe(COMMANDS.addOn,(addon:string)=>{
            keyhandler.callHandler('button',addon);
        })
        if (currentButtons.current) {
            if (!handleInitialButton(history)) {
                let hasSet=false;
                const last = globalStore.getData(keys.gui.addonpage.activeAddOn);
                if (last) {
                    for (const button of currentButtons.current){
                        if (button.name === last && button.isAddon){
                            keyhandler.callHandler('button', last);
                            hasSet=true;
                            break;
                        }
                    }
                }
                if (! hasSet){
                    //no addon select - trigger the first button
                    for (const button of currentButtons.current){
                        if (! button.isAddon) continue;
                        if (button.name && button.onClick){
                            keyhandler.callHandler('button', button.name);
                            break;
                        }
                    }
                }
            }
        }
        return ()=>{
            base.log("AddOnPage dismiss");
            remotechannel.unsubscribe(remoteToken);
        }
    }, []);

    return <PageFrame
        {...props}
        id={PAGE}
        >
        <PageLeft title={PAGE_TITLES.ADDON}>
            <div className="emptyPage">
                No addons configured
            </div>
        </PageLeft>
        <ButtonList page={PAGE} itemList={finalButtons} />
    </PageFrame>
}

export default AddOnPage;