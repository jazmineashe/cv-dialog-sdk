/**
 * Created by rburson on 3/31/15.
 */

import {StringDictionary} from "../util/Types";
import {EntityRecDef} from "./EntityRecDef";

export class XChangePaneModeResult {

    constructor(public editorRecordDef:EntityRecDef,
                public dialogProperties:StringDictionary) {
    }

    get entityRecDef():EntityRecDef {
        return this.editorRecordDef;
    }

    get dialogProps():StringDictionary {
        return this.dialogProperties;
    }

}
