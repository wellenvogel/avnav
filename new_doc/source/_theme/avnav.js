window.onload=function(){
    var b=document.getElementsByTagName('body')[0];
    var sideBar=document.querySelector('.sphinxsidebar');
    var showBar=function(){
        b.classList.add("showBar");
    }
    var removeBar=function(){
        b.classList.remove("showBar");
    }
    var sideBarLinks=document.querySelectorAll('.sphinxsidebar a');
    for (var i=0;i<sideBarLinks.length;i++){
        var link=sideBarLinks[i];
        link.addEventListener("click",removeBar);
    }
    var content=document.querySelector('.documentwrapper');
    if (content){
        content.addEventListener("click",removeBar);
    }
    //Test
    var rel=document.querySelector('.related');
    if (rel){
        rel.addEventListener('click',showBar);
    }
};