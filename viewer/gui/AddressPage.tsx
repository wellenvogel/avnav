/**
 * Created by andreas on 02.05.14.
 */

import ItemList, {Item} from '../components/ItemList';
import globalStore from '../util/globalstore';
import keys from '../util/keys';
import React from 'react';
import {PageFrame, PageLeft, PageProps} from '../components/Page';
import Requests from '../util/requests';
import QRCode from 'qrcode.react';
import {useHistory} from "../components/HistoryProvider";
import {useTimer} from "../util/UiHelper";
import {getPageTitle, PAGEIDS} from "../util/pageids";
import ButtonList from "../components/ButtonList";
import {InjectMainMenu} from "./MainNav";
import {propsToDefs, updateButtons} from "../components/Button";
import {GeneralWithCancel} from "./GeneralButtons";
import {iconClasses} from '../components/Icons';

const AddressItem = (props: { value: string }) => {
    const url = "http://" + props.value;
    return (
        <div className="address">
            <div className="url">
                {url}
            </div>
            <QRCode value={url}/>
        </div>

    );
};

const AddressPage = (props: PageProps) => {
    const history = useHistory();
    const [addresses, setAddresses] = React.useState([]);
    const buttons = [
        {
            name: 'AndroidBrowser',
            iconClass: iconClasses.Browser,
            visible: globalStore.getData(keys.gui.global.onAndroid),
            onClick: () => { // @ts-ignore
                window.avnavAndroid.launchBrowser();
            }
        },
    ];

    const timer = useTimer(
        (seq: number) => {
            Requests.getJson({
                request: 'api',
                type: 'config',
                command: 'status'
            }, {checkOk: false}).then(
                (json) => {
                    const list: any[] = [];
                    if (json.handler) {
                        json.handler.forEach((el: any) => {
                            if (el.properties && el.properties.addresses) {
                                for (let i = 0; i < el.properties.addresses.length; i++) {
                                    list.push(el.properties.addresses[i]);
                                }
                            }
                        });
                    }
                    setAddresses(list);
                    timer.startTimer(seq);
                },
                () => {
                    timer.startTimer(seq)
                }
            )
        },
        globalStore.getData(keys.properties.statusQueryTimeout),
        true,
        true
    )
    const itemList: Item[] = [];
    for (const addr of addresses) {
        itemList.push({name: addr, value: addr});
    }
    return <PageFrame id={props.id}>
        <PageLeft id={props.id} title={getPageTitle(props.id)}>
            <ItemList
                itemList={itemList}
                itemClass={AddressItem}
                scrollable={true}
            />
        </PageLeft>
        <ButtonList page={props.id}
                    itemList={InjectMainMenu(props.id,
                        updateButtons(GeneralWithCancel.concat(propsToDefs(buttons)), {
                            Cancel: {
                                onClick: () => {
                                    history.replace(PAGEIDS.SERVER)
                                },
                                visible: history.isPrevious(PAGEIDS.SERVER),
                            }
                        }))}/>
    </PageFrame>

}

export default AddressPage;