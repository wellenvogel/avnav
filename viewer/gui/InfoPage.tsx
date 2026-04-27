/**
 * Created by andreas on 02.05.14.
 */

import React, {useEffect, useRef, useState} from 'react';
import {PageFrame, PageLeft, PageProps} from '../components/Page';
import Requests from '../util/requests';
// @ts-ignore
import AvNavVersion from '../version.js';
import {useHistory} from "../components/HistoryProvider";
import {getPageTitle, PAGEIDS} from "../util/pageids";
import ButtonList from "../components/ButtonList";
import {ButtonDef, updateButtons} from "../components/Button";
import {InjectMainMenu, useInitialButton} from "./MainNav";
import {GeneralWithCancel} from "./GeneralButtons";

const InfoPage=(props:PageProps)=> {
    const history = useHistory();
    const infoRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const privacyRef = useRef<HTMLDivElement>(null);
    const [info,setInfo]=useState("");
    const [license,setLicense]=useState("");
    const [privacy,setPrivacy]=useState("");
    const currentButtons=useRef<ButtonDef[]>(null);
    const buttonActions = {
        Cancel: {
            onClick: () => {
                history.replace(PAGEIDS.SERVER);
            },
            visible: history.isPrevious(PAGEIDS.SERVER),
        }
    }
    currentButtons.current=InjectMainMenu(props.id,updateButtons(GeneralWithCancel,buttonActions));
    useInitialButton(currentButtons);
    const showLicense=()=>{
        const target=infoRef.current;
        if (! target) return;
        const parent=frameRef.current;
        if (! parent) return;
        parent.scrollTop=0;
    }
    const showPrivacy=()=>{
        const target= privacyRef.current;
        if (! target) return;
        const parent=frameRef.current;
        if (! parent) return;
        parent.scrollTop=target.offsetTop-parent.offsetTop;
    }
    useEffect(()=> {
        Requests.getHtmlOrText('info.html').then((text) => {
            setInfo(text);
        }, () => {
        });
        Requests.getHtmlOrText('license.html').then((text) => {
            setLicense(text);
        }, () => {
        });
        Requests.getHtmlOrText('privacy-en.html').then((text) => {
            setPrivacy(text);
        }, () => {
        });
    },[]);
    return <PageFrame id={props.id}>
        <PageLeft id={props.id} title={getPageTitle(props.id)}>
            <div className="linkWrapper">
                <div className="link" onClick={showLicense}>License</div>
                <div className="link" onClick={showPrivacy}>PrivacyInfo</div>
            </div>
            <div className="avnavVersion">{ "Version: "+AvNavVersion}</div>
            <div className="listContainer scrollable" ref={frameRef}>
            <div className="infoFrame" >
                <div className="infoText" dangerouslySetInnerHTML={{__html: info}} ref={infoRef}>
                </div>
                <div className="licenseText" dangerouslySetInnerHTML={{__html: license}} >
                </div>
                <div className="privacyText" dangerouslySetInnerHTML={{__html: privacy}} ref={privacyRef}>
                </div>
            </div>
            </div>
        </PageLeft>
        <ButtonList page={props.id} itemList={currentButtons.current}></ButtonList>
        </PageFrame>
}

export default InfoPage;