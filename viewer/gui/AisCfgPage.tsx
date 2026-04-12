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
import React, {useRef} from "react";
import {getPageTitle, PAGEIDS} from "../util/pageids";
import {PageBaseProps, PageFrame, PageLeft} from "../components/Page";
import {useStoreState} from "../hoc/Dynamic";
import keys from "../util/keys";
import StatusView, {ChannelKinds} from "../components/StatusView";
import ButtonList from "../components/ButtonList";
import {useHistory} from "../components/HistoryProvider";
import {InjectMainMenu, useInitialButton} from "./MainNav";
import {ButtonDef, DynamicButtonProps, updateButtons} from "../components/Button";
import {showDialog} from "../components/OverlayDialog";
import {EditSettingsCategory} from "../components/Settings";
import AisCfgPageButtons from "./AisCfgPageButtons";
import {AisButtonActions, CompleteAisListWithStore} from './AisPage';
import {MultiView, MvHeadline, useScrollHelper} from "../components/MultiView";

const PAGE=PAGEIDS.AISCFG;
const TITLE=getPageTitle(PAGE);
export type AisCfgPageProps = Partial<PageBaseProps>;
const AisCfgPage=(props:AisCfgPageProps)=>{
     useStoreState(keys.gui.global.reloadSequence);
     const history=useHistory();
     const [scrollProps,scrollTo,isVisible]=useScrollHelper(0);
     const buttonListRef=useRef<ButtonDef[]>();
     const buttonActions:Record<string,Partial<DynamicButtonProps>> ={
         ServerView:{
             onClick:()=>scrollTo(0),
             disabled:props.pageColumns >1,
             toggle: isVisible(0),
         },
         ItemsView:{
             onClick:()=>scrollTo(1),
             disabled:props.pageColumns>1,
             toggle:isVisible(1),
         },
         Cancel:{
             onClick:()=>history.pop()
         },
         ShowSettings:{
             onClick:()=>{
                 showDialog(undefined, ()=><EditSettingsCategory
                     category={"AIS"}
                     title={'Ais Compute & Display'}
                 />)
             }
         },
             ...AisButtonActions({
                 nearestAction:()=>history.push(PAGEIDS.NAV)
             })
     }
     //enable/disable buttons
     for (const button of ['AisNearest','AisSort','AisLock','AisSearch']){
         buttonActions[button]={...buttonActions[button],disabled:! isVisible(1)};
     }
     buttonListRef.current=updateButtons(AisCfgPageButtons,buttonActions);
     useInitialButton(buttonListRef);
    return <PageFrame id={PAGE}>
        <PageLeft
            id={PAGE}
            title={TITLE}>
            <MultiView
                {...scrollProps}
                       views={[
                <React.Fragment key={"0"}>
                    <MvHeadline
                        title={"Server"}
                    />
                <StatusView
                    kinds={[ChannelKinds.AIS]}
                ></StatusView>
                </React.Fragment>
                ,
                <React.Fragment key={"1"}>
                              <MvHeadline
                                title={"AIS Targets"}
                              >
                              </MvHeadline>
                              <CompleteAisListWithStore
                                  hidden={!isVisible(1)}
                              />
                              </React.Fragment>
                ]}
                       maxNumber={props.pageColumns}
            />

        </PageLeft>
        <ButtonList
            page={PAGE}
            itemList={InjectMainMenu(PAGE,
                buttonListRef.current,
            )}
        ></ButtonList>
    </PageFrame>
}

export default AisCfgPage;