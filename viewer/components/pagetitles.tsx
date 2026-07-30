import {PageType} from "../util/pageids";
import Helper from "../util/helper";
import React from "react";
import buttonDefs, {MMPREFIX} from "./ButtonDefs";

export const getPageTitle = (page: PageType) => {
    // @ts-ignore
    const pageButton=buttonDefs[MMPREFIX+page];
    const txtClass=pageButton?.name || MMPREFIX+page;
    return <span className={Helper.concatsp("pageTitle mmButton",txtClass)}></span>
}