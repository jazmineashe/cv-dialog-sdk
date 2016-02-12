/**
 * Created by rburson on 3/23/15.
 */
import { XCalendarDef } from "./XCalendarDef";
import { AppWinDef } from "./AppWinDef";
import { AttributeCellValueDef } from "./AttributeCellValueDef";
import { XBarcodeScanDef } from "./XBarcodeScanDef";
import { CellDef } from "./CellDef";
import { XChangePaneModeResult } from "./XChangePaneModeResult";
import { ColumnDef } from "./ColumnDef";
import { ContextAction } from "./ContextAction";
import { SessionContextImpl } from "./SessionContextImpl";
import { DialogHandle } from "./DialogHandle";
import { DataAnno } from "./DataAnno";
import { XDetailsDef } from "./XDetailsDef";
import { DialogRedirection } from "./DialogRedirection";
import { EntityRecDef } from "./EntityRecDef";
import { ForcedLineCellValueDef } from "./ForcedLineCellValueDef";
import { XFormDef } from "./XFormDef";
import { XFormModelComp } from "./XFormModelComp";
import { XGeoFixDef } from "./XGeoFixDef";
import { XGeoLocationDef } from "./XGeoLocationDef";
import { XGetActiveColumnDefsResult } from "./XGetActiveColumnDefsResult";
import { XGetSessionListPropertyResult } from "./XGetSessionListPropertyResult";
import { GraphDataPointDef } from "./GraphDataPointDef";
import { XGraphDef } from "./XGraphDef";
import { XPropertyChangeResult } from "./XPropertyChangeResult";
import { XImagePickerDef } from "./XImagePickerDef";
import { LabelCellValueDef } from "./LabelCellValueDef";
import { XListDef } from "./XListDef";
import { XMapDef } from "./XMapDef";
import { MenuDef } from "./MenuDef";
import { XOpenEditorModelResult } from "./XOpenEditorModelResult";
import { XOpenQueryModelResult } from "./XOpenQueryModelResult";
import { XPaneDefRef } from "./XPaneDefRef";
import { PropDef } from "./PropDef";
import { XReadResult } from "./XReadResult";
import { SortPropDef } from "./SortPropDef";
import { SubstitutionCellValueDef } from "./SubstitutionCellValueDef";
import { TabCellValueDef } from "./TabCellValueDef";
import { WebRedirection } from "./WebRedirection";
import { Workbench } from "./Workbench";
import { WorkbenchRedirection } from "./WorkbenchRedirection";
import { WorkbenchLaunchAction } from "./WorkbenchLaunchAction";
import { XWriteResult } from "./XWriteResult";
import { CellValueDef } from "./CellValueDef";
import { XFormModel } from "./XFormModel";
import { XGetAvailableValuesResult } from "./XGetAvailableValuesResult";
import { XPaneDef } from "./XPaneDef";
import { Prop } from "./Prop";
import { XQueryResult } from "./XQueryResult";
import { Redirection } from "./Redirection";
import { Log } from "../util/Log";
import { ObjUtil } from "../util/ObjUtil";
import { Failure } from "../fp/Failure";
import { DialogTriple } from "./DialogTriple";
import { Success } from "../fp/Success";
import { EntityRecUtil } from "./EntityRec";
export class OType {
    static typeInstance(name) {
        var type = OType.types[name];
        return type && new type;
    }
    static factoryFn(otype, jsonObj) {
        var typeFn = OType.typeFns[otype];
        if (typeFn) {
            return typeFn(otype, jsonObj);
        }
        return null;
    }
    static deserializeObject(obj, Otype, factoryFn) {
        Log.debug('Deserializing ' + Otype);
        if (Array.isArray(obj)) {
            //it's a nested array (no LTYPE!)
            return OType.handleNestedArray(Otype, obj);
        }
        else {
            var newObj = null;
            var objTry = factoryFn(Otype, obj); //this returns null if there is no custom function
            if (objTry) {
                if (objTry.isFailure) {
                    var error = 'OType::deserializeObject: factory failed to produce object for ' + Otype + " : "
                        + ObjUtil.formatRecAttr(objTry.failure);
                    Log.error(error);
                    return new Failure(error);
                }
                newObj = objTry.success;
            }
            else {
                newObj = OType.typeInstance(Otype);
                if (!newObj) {
                    Log.error('OType::deserializeObject: no type constructor found for ' + Otype);
                    return new Failure('OType::deserializeObject: no type constructor found for ' + Otype);
                }
                for (var prop in obj) {
                    var value = obj[prop];
                    Log.debug("prop: " + prop + " is type " + typeof value);
                    if (value && typeof value === 'object') {
                        if ('WS_OTYPE' in value) {
                            var otypeTry = DialogTriple.fromWSDialogObject(value, value['WS_OTYPE'], OType.factoryFn);
                            if (otypeTry.isFailure)
                                return new Failure(otypeTry.failure);
                            OType.assignPropIfDefined(prop, otypeTry.success, newObj, Otype);
                        }
                        else if ('WS_LTYPE' in value) {
                            var ltypeTry = DialogTriple.fromListOfWSDialogObject(value, value['WS_LTYPE'], OType.factoryFn);
                            if (ltypeTry.isFailure)
                                return new Failure(ltypeTry.failure);
                            OType.assignPropIfDefined(prop, ltypeTry.success, newObj, Otype);
                        }
                        else {
                            OType.assignPropIfDefined(prop, obj[prop], newObj, Otype);
                        }
                    }
                    else {
                        OType.assignPropIfDefined(prop, obj[prop], newObj, Otype);
                    }
                }
            }
            return new Success(newObj);
        }
    }
    static serializeObject(obj, Otype, filterFn) {
        var newObj = { 'WS_OTYPE': Otype };
        return ObjUtil.copyNonNullFieldsOnly(obj, newObj, (prop) => {
            return prop.charAt(0) !== '_' && (!filterFn || filterFn(prop));
        });
    }
    static handleNestedArray(Otype, obj) {
        return OType.extractLType(Otype).bind((ltype) => {
            var newArrayTry = OType.deserializeNestedArray(obj, ltype);
            if (newArrayTry.isFailure)
                return new Failure(newArrayTry.failure);
            return new Success(newArrayTry.success);
        });
    }
    static deserializeNestedArray(array, ltype) {
        var newArray = [];
        for (var i = 0; i < array.length; i++) {
            var value = array[i];
            if (value && typeof value === 'object') {
                var otypeTry = DialogTriple.fromWSDialogObject(value, ltype, OType.factoryFn);
                if (otypeTry.isFailure) {
                    return new Failure(otypeTry.failure);
                }
                newArray.push(otypeTry.success);
            }
            else {
                newArray.push(value);
            }
        }
        return new Success(newArray);
    }
    static extractLType(Otype) {
        if (Otype.length > 5 && Otype.slice(0, 5) !== 'List<') {
            return new Failure('Expected OType of List<some_type> but found ' + Otype);
        }
        var ltype = Otype.slice(5, -1);
        return new Success(ltype);
    }
    static assignPropIfDefined(prop, value, target, otype = 'object') {
        try {
            if ('_' + prop in target) {
                target['_' + prop] = value;
            }
            else {
                //it may be public
                if (prop in target) {
                    target[prop] = value;
                }
                else {
                    Log.debug("Didn't find target value for prop " + prop + " on target for " + otype);
                }
            }
        }
        catch (error) {
            Log.error('OType::assignPropIfDefined: Failed to set prop: ' + prop + ' on target: ' + error);
        }
    }
}
OType.types = {
    'WSApplicationWindowDef': AppWinDef,
    'WSAttributeCellValueDef': AttributeCellValueDef,
    'WSBarcodeScanDef': XBarcodeScanDef,
    'WSCalendarDef': XCalendarDef,
    'WSCellDef': CellDef,
    'WSChangePaneModeResult': XChangePaneModeResult,
    'WSColumnDef': ColumnDef,
    'WSContextAction': ContextAction,
    'WSCreateSessionResult': SessionContextImpl,
    'WSDialogHandle': DialogHandle,
    'WSDataAnno': DataAnno,
    'WSDetailsDef': XDetailsDef,
    'WSDialogRedirection': DialogRedirection,
    'WSEditorRecordDef': EntityRecDef,
    'WSEntityRecDef': EntityRecDef,
    'WSForcedLineCellValueDef': ForcedLineCellValueDef,
    'WSFormDef': XFormDef,
    'WSFormModelComp': XFormModelComp,
    'WSGeoFixDef': XGeoFixDef,
    'WSGeoLocationDef': XGeoLocationDef,
    'WSGetActiveColumnDefsResult': XGetActiveColumnDefsResult,
    'WSGetSessionListPropertyResult': XGetSessionListPropertyResult,
    'WSGraphDataPointDef': GraphDataPointDef,
    'WSGraphDef': XGraphDef,
    'WSHandlePropertyChangeResult': XPropertyChangeResult,
    'WSImagePickerDef': XImagePickerDef,
    'WSLabelCellValueDef': LabelCellValueDef,
    'WSListDef': XListDef,
    'WSMapDef': XMapDef,
    'WSMenuDef': MenuDef,
    'WSOpenEditorModelResult': XOpenEditorModelResult,
    'WSOpenQueryModelResult': XOpenQueryModelResult,
    'WSPaneDefRef': XPaneDefRef,
    'WSPropertyDef': PropDef,
    'WSQueryRecordDef': EntityRecDef,
    'WSReadResult': XReadResult,
    'WSSortPropertyDef': SortPropDef,
    'WSSubstitutionCellValueDef': SubstitutionCellValueDef,
    'WSTabCellValueDef': TabCellValueDef,
    'WSWebRedirection': WebRedirection,
    'WSWorkbench': Workbench,
    'WSWorkbenchRedirection': WorkbenchRedirection,
    'WSWorkbenchLaunchAction': WorkbenchLaunchAction,
    'XWriteResult': XWriteResult
};
OType.typeFns = {
    'WSCellValueDef': CellValueDef.fromWS,
    'WSDataAnnotation': DataAnno.fromWS,
    'WSEditorRecord': EntityRecUtil.fromWSEditorRecord,
    'WSFormModel': XFormModel.fromWS,
    'WSGetAvailableValuesResult': XGetAvailableValuesResult.fromWS,
    'WSPaneDef': XPaneDef.fromWS,
    'WSOpenQueryModelResult': XOpenQueryModelResult.fromWS,
    'WSProp': Prop.fromWS,
    'WSQueryResult': XQueryResult.fromWS,
    'WSRedirection': Redirection.fromWS,
    'WSWriteResult': XWriteResult.fromWS
};
//# sourceMappingURL=OType.js.map