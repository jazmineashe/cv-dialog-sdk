/**
 * Created by rburson on 3/13/15.
 */

module catavolt.dialog {

    export class AppWinDef {

        private _workbenches:Array<Workbench>;
        private _appVendors:Array<string>;
        private _windowTitle:string;
        private _windowWidth:number;
        private _windowHeight:number;

        static fromWSApplicationWindowDef(jsonObject:StringDictionary): Try<AppWinDef> {

            return DialogTriple.extractValue(jsonObject, "WSApplicationWindowDef",
                ()=>{
                    Workbench.fromListOf
                }
            );
        }

        constructor(workbenches:Array<Workbench>,
                    appVendors:Array<string>,
                    windowTitle:string,
                    windowWidth:number,
                    windowHeight:number) {

            this._workbenches = workbenches || [];
            this._appVendors = appVendors || [];
            this._windowTitle = windowTitle;
            this._windowWidth = windowWidth;
            this._windowHeight = windowHeight;
        }

        get appVendors():Array<string> {
            return this._appVendors;
        }

        get windowHeight():number {
            return this._windowHeight;
        }

        get windowTitle():string {
            return this._windowTitle;
        }

        get windowWidth():number {
            return this._windowWidth;
        }

        get workbenches():Array<Workbench> {
            return this._workbenches;
        }

    }
}

