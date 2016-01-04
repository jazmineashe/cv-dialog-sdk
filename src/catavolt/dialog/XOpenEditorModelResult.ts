/**
 * Created by rburson on 4/1/15.
 */

///<reference path="../references.ts"/>

module catavolt.dialog {

    export class XOpenEditorModelResult implements XOpenDialogModelResult{

        constructor(public editorRecordDef:EntityRecDef, public formModel:XFormModel) {
        }

        get entityRecDef():EntityRecDef {
            return this.editorRecordDef;
        }

        get formPaneId():string {
            return this.formModel.form.paneId;
        }

        get formRedirection():DialogRedirection {
            return this.formModel.form.redirection;
        }

    }
}