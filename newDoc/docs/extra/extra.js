
const iconvariants=['iconset-default','iconset-legacy'];
const update=(initial)=>{
    let activeText='unknown';
    for (const ics of iconvariants){
        const active=document.body.classList.contains(ics);
        const action=document.getElementById('select-'+ics);
        if (action){
            if (initial){
                action.addEventListener('click',()=>{
                    iconvariants.forEach((iv)=>{
                        if (iv === ics){
                            document.body.classList.add(iv);
                        }
                        else{
                            document.body.classList.remove(iv);
                        }
                        update();
                    })
                })
            }
            if (active) action.parentElement.classList.add('selected');
            else action.parentElement.classList.remove('selected');
            if (active) activeText=ics.replace('iconset-','');
        }
    }
    const display=document.getElementById('iconset-current');
    if (display) display.textContent=activeText;
}
document$.subscribe(()=>{
    document.body.classList.add('iconset-default');
    update(true);
})