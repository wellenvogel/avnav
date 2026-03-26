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
import React, {useRef, useState} from "react";
import {PAGE_TITLES, PAGEIDS} from "../util/pageids";
import {PageBaseProps, PageFrame, PageLeft} from "../components/Page";
import {useStoreState} from "../hoc/Dynamic";
import keys from "../util/keys";
import StatusView, {ChannelKinds} from "../components/StatusView";
import ButtonList from "../components/ButtonList";
import {useHistory} from "../components/HistoryProvider";
import {InjectMainMenu, useInitialButton} from "./MainNav";
import {ButtonDef, updateButtons} from "../components/Button";
import {CombinedView} from "../components/CombinedView";
import {ScrollType} from "../util/UiHelper";
import Headline from "../components/Headline";
// @ts-ignore
import {showDialog} from "../components/OverlayDialog";
import {EditSettingsCategory} from "../components/Settings";
import AisCfgPageButtons from "./AisCfgPageButtons";
// @ts-ignore
import {CompleteAisList} from './AisPage';

const PAGE=PAGEIDS.AISCFG;
const TITLE=PAGE_TITLES.AISCFG;
export type AisCfgPageProps = Partial<PageBaseProps>;
const AisCfgPage=(props:AisCfgPageProps)=>{
     useStoreState(keys.gui.global.reloadSequence);
     const history=useHistory();
     const [scrollType, setScrollType] = useState<ScrollType>(ScrollType.left);
     const buttonListRef=useRef<ButtonDef[]>();
     const buttonActions={
         ServerView:{
             onClick:()=>setScrollType(ScrollType.left),
             disabled:props.settingsSplit,
             toggle: scrollType===ScrollType.left||props.settingsSplit,
         },
         ItemsView:{
             onClick:()=>setScrollType(ScrollType.right),
             disabled:props.settingsSplit,
             toggle:scrollType===ScrollType.right||props.settingsSplit,
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
         }
     }
     buttonListRef.current=updateButtons(AisCfgPageButtons,buttonActions);
     useInitialButton(buttonListRef);
    return <PageFrame id={PAGE}>
        <PageLeft title={TITLE}>
            <CombinedView leftView={
                <React.Fragment>
                    <Headline title={"Server"}/>
                <StatusView
                    kinds={[ChannelKinds.AIS]}
                ></StatusView>
                </React.Fragment>
            }
                          rightView={
                            <React.Fragment>
                              <Headline title={"AIS Targets"}></Headline>
                              <CompleteAisList/>
                              </React.Fragment>
                          }
                          single={!props.settingsSplit}
                          scrollType={scrollType}
                          viewChanged={(left:boolean)=>setScrollType(left?ScrollType.left:ScrollType.right)}
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