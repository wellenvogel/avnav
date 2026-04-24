const CMD="desk2"; //see plugin.py
export default async (api)=>{
    const res=fetch("/api/command/list").then((res)=>res.json);
    if (! Array.isArray(res.data)){
        api.log("no commands found");
        for (let cmd of res.data){
            if (cmd.name === CMD){
                api.registerUserButton({
                    name:'Desk2',
                    displayName:'desk 2',
                    icon: cmd.icon,
                    onClick:()=>{
                        fetch("/api/command/runCommand?name="+encodeURIComponent(CMD));
                    }

                },':actions');
                api.log("registered desk2 user button in actions");
                return;
            }
        }
    }
    api.log(`no server command ${CMD} found`);
}