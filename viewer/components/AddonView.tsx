/**
 * # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
 #
 #  Permission is hereby granted, free of charge, to any person obtaining a
 #  copy of this software and associated documentation files (the "Software"),
 #  to deal in the Software without restriction, including without limitation
 #  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 #  and/or sell copies of the Software, and to permit persons to whom the
 #  Software is furnished to do so, subject to the following conditions:
 #
 #  The above copyright notice and this permission notice shall be included
 #  in all copies or substantial portions of the Software.
 #
 #  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 #  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 #  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 */
 
import React, {ElementType, useEffect} from 'react';
import {UserApp} from "../api/api.interface";
import {DynamicProps, useStore} from "../hoc/Dynamic";
import Helper from "../util/helper";
import Headline from "./Headline";
// @ts-ignore
import alarmhandler, {LOCAL_TYPES} from "../nav/alarmhandler";
import {PageType} from "../util/pageids";
import globalstore from "../util/globalstore";
import keys from "../util/keys";
import {PageUserButton} from "../util/Addons";
export interface AddonViewProps extends UserApp{
    className?:string;
    visible?:boolean;
    preventConnectionLost?: boolean;
    name:string;
}

export const AddonView = (iprops: AddonViewProps): React.ReactNode => {
    const sprops = useStore(iprops);
    useEffect(() => {
        if (iprops.preventConnectionLost){
            const id=alarmhandler.addBlock(LOCAL_TYPES.preventConnectionLost);
            return ()=>alarmhandler.removeBlock(id);
        }
    }, []);
    if (! Helper.unsetorTrue(sprops.visible)) {
        return null
    }
    return <div className={Helper.concatsp("addOnFrame", sprops.className)}>
        {sprops.title && <Headline dynamicTitleIcons={false} title={sprops.title}/>}
        <div className={'addonInner'}>
            {(!sprops.renderHtml && !sprops.url) && <div>{`no url/html for ${iprops.name}`}</div>}
            {iprops.renderHtml && iprops.renderHtml(iprops)}
            {sprops.url && <iframe className={"addonIframe"} src={sprops.url}/>}
        </div>
    </div>
}

export const injectAddonButtonAction=(
    button:PageUserButton,
    page:PageType
    ):PageUserButton=>{
    const config=button.config;
    if (! config){return button}
    if (button.onClick) return button;
    const rt={...button};
    if (config.url && config.newWindow){
        rt.onClick=()=> {
            window.open(config.url, config.name);
        }
        return rt;
    }
    rt.onClick=()=> {
        if (addonViewManager.hasPageAddon(page, config.name)) {
            addonViewManager.setPageAddon(page);
            return;
        }
        addonViewManager.setPageAddon(page, config.name, () => <AddonView {...config}/>);
    }
    rt.storeKeys={
        toggle:keys.gui.global.addonViewChanged
    }
    rt.updateFunction=(_state:DynamicProps)=>{
        return {
            toggle: !! addonViewManager.hasPageAddon(page, config.name),
        }
    }
    return rt;
}

class PageAddonView{
    name:string;
    element:ElementType;
    constructor(name: string, element:ElementType) {
        this.name = name;
        this.element = element;
    }
}
export class AddonViewManager{
    private activeViews:Record<PageType,PageAddonView>={}
    constructor(){
        globalstore.register(()=>{
            this.activeViews={};
            globalstore.storeData(keys.gui.global.addonViewChanged,globalstore.getData(keys.gui.global.addonViewChanged,0)+1);
        },keys.gui.global.addonsChanged);
    }
    setPageAddon(page:PageType,name?:string,display?:ElementType){
        if (!page) return;
        if (! name || ! display){
            delete this.activeViews[page];
        }
        else {
            this.activeViews[page] = new PageAddonView(name,display);
        }
        globalstore.storeData(keys.gui.global.addonViewChanged,globalstore.getData(keys.gui.global.addonViewChanged,0)+1);
    }
    hasPageAddon(page:PageType,name:string){
        const pageItem=this.activeViews[page];
        return (pageItem?.name ===name);
    }
    getPageAddon(page:PageType){
        return this.activeViews[page]?.element;
    }
}

export const addonViewManager=new AddonViewManager();