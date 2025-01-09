import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import Requests from '../util/requests.js';
import {DialogButtons, DialogFrame, DialogRow} from './OverlayDialog.jsx';
import DB from './DialogButton.jsx';

const EulaDialog=(props)=>{
    const [eula,setEula]=useState(undefined);
    useEffect(() => {
        Requests.getHtmlOrText(props.eulaUrl)
            .then((html)=>{
                setEula(html);
            })
            .catch((error)=>{});
    }, []);

        return (
            <DialogFrame className="EulaDialog" title={'EULA'}>
                <DialogRow>{props.name}</DialogRow>
                <DialogRow className="eulaContainer">
                    {eula?
                        <div className="eula" dangerouslySetInnerHTML={{__html: eula}}></div>
                        :
                        <DialogRow >Loading EULA</DialogRow>
                    }

                </DialogRow>
                <DialogButtons>
                    <DB name="cancel">Cancel</DB>
                    <DB name="ok" onClick={() => {
                        props.resolveFunction(1);
                    }}>Accept</DB>
                </DialogButtons>
            </DialogFrame>
        );
}

EulaDialog.propTypes={
    eulaUrl: PropTypes.string,
    name: PropTypes.string,
    resolveFunction: PropTypes.func.isRequired
};

export default  EulaDialog;