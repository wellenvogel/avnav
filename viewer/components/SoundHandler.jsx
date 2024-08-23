import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import PropertyHandler from '../util/propertyhandler.js';
import Toast from '../components/Toast.jsx';
import compare from '../util/compare.js';
import globalStore from '../util/globalstore';
import keys from '../util/keys';

class SoundHandler extends React.Component{
    audioRef=createRef();
    constructor(props){
        super(props);
        this.state={
            initialized:false
        };
        this.repeatCount=0;
        this.checkSound=this.checkSound.bind(this);
        this.askForSound=this.askForSound.bind(this);
        this.playerFinished=this.playerFinished.bind(this);
        this.volume=globalStore.getData(keys.properties.alarmVolume,50);
        this.dataChanged=this.dataChanged.bind(this);
        globalStore.register(this.dataChanged,[keys.properties.alarmVolume]);
    }
    dataChanged(){
        this.volume=globalStore.getData(keys.properties.alarmVolume,50);
        if (this.audioRef.current){
            this.audioRef.current.volume=this.volume/100.0;
        }
    }
    render(){
        return <audio ref={this.audioRef} className="hidden"
                      onPlaying={()=>{
                        if (! this.state.initialized){
                            this.setState({initialized:true});
                            }
                        }}
                      onEnded={this.playerFinished}
                      volume={this.volume}
            />
    }

    /**
     * to handle the mobile restrictions
     * we check if we can play a sound - if not, we display a toast and let the user interact
     * on that to start the sound inside a user transaction
     */
    askForSound(){
        if (this.state.initialized) return;
        if (! this.audioRef.current) return;
        Toast("click to allow sounds",60000,()=>{
            this.setState({initialized:true});
            this.audioRef.current.play();
        })
    }
    playerFinished(){
        if (this.repeatCount > 0){
            this.repeatCount--;
            if (!this.audioRef.current) return;
            this.audioRef.current.play();
        }
    }
    checkSound(){
        if (! this.audioRef.current) return;
        let enabled=this.props.enabled === undefined || this.props.enabled;
        let src=enabled?this.props.src:undefined;
        this.repeatCount=this.props.repeat;
        if (! src && ! this.state.initialized && enabled) {
            src = PropertyHandler.getProperties().silenceSound;
            this.repeatCount = 10000;
        }
        if (this.repeatCount === undefined) this.repeatCount=10000;
        if (! src){
            this.audioRef.current.pause();
            this.audioRef.current.removeAttribute('src');
            return;
        }
        this.audioRef.current.src=src;
        try {
            this.audioRef.current.play().catch(this.askForSound);
        }catch(e){
            this.askForSound();
        }
    }
    componentDidMount(){
        this.checkSound();
    }
    componentDidUpdate(){
        this.checkSound();
    }
    componentWillUnmount() {
        globalStore.deregister(this.dataChanged);
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