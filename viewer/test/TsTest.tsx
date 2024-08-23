import React from "react";

export interface Test{
    name: string;
}

export default TestDisplay

function TestDisplay(props: Test) {
    return <div>{props.name}</div>;
}