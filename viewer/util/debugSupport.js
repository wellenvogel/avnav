import NavCompute from "../nav/navcompute";

const debugSupport=()=>{
    if (! window.avnav) window.avnav={};
    window.avnav.debug={
        navcompute: NavCompute
    }
};
debugSupport();
export default debugSupport;