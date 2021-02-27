import React from 'react';
import PropTypes from 'prop-types';
import PropertyHandler from '../util/propertyhandler.js';
import Toast from '../components/Toast.jsx';
import compare from '../util/shallowcompare.js';

class SoundHandler extends React.Component{
    constructor(props){
        super(props);
        this.state={
            initialized:false
        };
        this.repeatCount=0;
        this.checkSound=this.checkSound.bind(this);
        this.askForSound=this.askForSound.bind(this);
        this.playerFinished=this.playerFinished.bind(this);
    }
    render(){
        let self=this;
        return <audio ref="audio" className="hidden"
                      onPlaying={()=>{
                        if (! self.state.initialized){
                            self.setState({initialized:true});
                            }
                        }}
                      onEnded={self.playerFinished}
            />
    }

    /**
     * to handle the mobile restrictions
     * we check if we can play a sound - if not, we display a toast and let the user interact
     * on that to start the sound inside a user transaction
     */
    askForSound(){
        let self=this;
        if (this.state.initialized) return;
        if (! this.refs.audio) return;
        Toast("click to allow sounds",60000,()=>{
            self.setState({initialized:true});
            self.refs.audio.play();
        })
    }
    playerFinished(){
        if (this.repeatCount > 0){
            this.repeatCount--;
            if (!this.refs.audio) return;
            this.refs.audio.play();
        }
    }
    checkSound(){
        let self=this;
        if (! this.refs.audio) return;
        let enabled=this.props.enabled === undefined || this.props.enabled;
        let src=enabled?this.props.src:undefined;
        this.repeatCount=this.props.repeat;
        if (! src && ! this.state.initialized && enabled) {
            src = PropertyHandler.getProperties().silenceSound;
            this.repeatCount = 10000;
        }
        if (this.repeatCount === undefined) this.repeatCount=10000;
        if (! src){
            this.refs.audio.pause();
            this.refs.audio.removeAttribute('src');
            return;
        }
        this.refs.audio.src=src;
        try {
            this.refs.audio.play().catch(self.askForSound);
        }catch(e){
            self.askForSound();
        }
    }
    componentDidMount(){
        this.checkSound();
    }
    componentDidUpdate(){
        this.checkSound();
    }
    //we need to be intelligent here as
    //the store potentially will call us with the nested alarm object...
    shouldComponentUpdate(nextProps,nextState){
        if (!compare(this.state,nextState)) return true;
        return ! compare(this.props,nextProps);
    }

};

SoundHandler.propTypes={
    src: PropTypes.string,
    repeat: PropTypes.number,
    enabled: PropTypes.bool
};

export default SoundHandler;