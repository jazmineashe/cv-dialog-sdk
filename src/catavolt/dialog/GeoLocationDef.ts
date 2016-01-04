/**
 * Created by rburson on 4/22/15.
 */

///<reference path="../references.ts"/>

/* @TODO */
module catavolt.dialog {

    export class GeoLocationDef extends PaneDef{

        constructor(paneId:string,
                    name:string,
                    label:string,
                    title:string,
                    menuDefs:Array<MenuDef>,
                    entityRecDef:EntityRecDef,
                    dialogRedirection:DialogRedirection,
                    settings:StringDictionary) {

            super(paneId, name, label, title, menuDefs, entityRecDef, dialogRedirection, settings);

        }
    }
}