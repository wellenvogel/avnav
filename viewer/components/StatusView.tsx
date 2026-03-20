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
import React, {useEffect} from 'react';
import ItemList from "./ItemList";
// @ts-ignore
import Requests from '../util/requests';
export interface StatusViewProps{
    className?: string;
    kinds?:string[];
}
const queryStatus= async ():Promise<any[]>=>{
    return Requests.getJson({
        request:'api',
        type:'config',
        command:'status'
    }).then(
        (json:any)=>{
            return json.data as any[]
        });
}

// eslint-disable-next-line react/display-name
export default (props:StatusViewProps)=>{
    const [statusList, setStatusList] = React.useState<any[]>([]);
    useEffect(() => {
        queryStatus().then((data)=>setStatusList(data))
    }, []);
    return <ItemList className={props.className}
        itemList={statusList}
        />
}

