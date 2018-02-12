/**
 * Created by andreas on 04.05.14.
 */
let toast=undefined;
let Overlay={};

/**
 *
 * @param html the html to display
 * @param time time to show, 500 default
 * @param opt_callback if set will be called back on click
 */
Overlay.Toast=function(html,time,opt_callback){
    if (! time) time=5000;
    if (! toast){
        toast=document.getElementById('avi_toast');
    }
    if (! toast) return;
    const clickHandler=()=>{
        toast.style.display='none';
        toast.removeEventListener('click',clickHandler);
        if (opt_callback) opt_callback();
    };
    toast.removeEventListener('click',clickHandler);
    toast.innerHTML=html;
    toast.addEventListener('click', clickHandler);
    toast.style.display='block';
    window.setTimeout(()=>{
        toast.style.display='none';
    },time);
};
Overlay.hideToast=function(){
    if (! toast) return;
    toast.style.display='none';
};

module.exports=Overlay;