///<reference path="../../typings/react/react-global.d.ts"/>
///<reference path="../catavolt/references.ts"/>
///<reference path="references.ts"/>

Log.logLevel(LogLevel.DEBUG);

ReactDOM.render(

    <CatavoltPane persistentWorkbench={true}>

    </CatavoltPane>,

    document.getElementById('cvApp')

)
