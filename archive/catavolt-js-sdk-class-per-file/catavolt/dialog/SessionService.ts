/**
 * Created by rburson on 3/9/15.
 */

import {SystemContext} from "../ws/SystemContext";
import {Future} from "../fp/Future";
import {SessionContext} from "../ws/SessionContext";
import {StringDictionary} from "../util/Types";
import {Call} from "../ws/Request";
import {SessionContextImpl} from "./SessionContextImpl";
import {VoidResult} from "./VoidResult";
import {OType} from "./OType";
import {XGetSessionListPropertyResult} from "./XGetSessionListPropertyResult";
import {DialogTriple} from "./DialogTriple";

export class SessionService {

    private static SERVICE_NAME = "SessionService";
    private static SERVICE_PATH = "soi-json-v02/" + SessionService.SERVICE_NAME;

    static createSession(tenantId:string,
                         userId:string,
                         password:string,
                         clientType:string,
                         systemContext:SystemContext):Future<SessionContext> {

        var method = "createSessionDirectly";

        var params:StringDictionary = {
            'tenantId': tenantId,
            'userId': userId,
            'password': password,
            'clientType': clientType
        };
        var call = Call.createCallWithoutSession(SessionService.SERVICE_PATH, method, params, systemContext);

        return call.perform().bind(
            (result:StringDictionary)=> {
                return Future.createCompletedFuture("createSession/extractSessionContextFromResponse",
                    SessionContextImpl.fromWSCreateSessionResult(result, systemContext));
            }
        );

    }

    static deleteSession(sessionContext:SessionContext):Future<VoidResult> {

        var method = "deleteSession";
        var params:StringDictionary = {
            'sessionHandle': sessionContext.sessionHandle
        };
        var call = Call.createCall(SessionService.SERVICE_PATH, method, params, sessionContext);
        return call.perform().bind(
            (result:StringDictionary)=> {
                return Future.createSuccessfulFuture<VoidResult>("deleteSession/extractVoidResultFromResponse", result);
            }
        );
    }

    static getSessionListProperty(propertyName:string, sessionContext:SessionContext):Future<XGetSessionListPropertyResult> {

        var method = "getSessionListProperty";
        var params:StringDictionary = {
            'propertyName': propertyName,
            'sessionHandle': sessionContext.sessionHandle
        };
        var call = Call.createCall(SessionService.SERVICE_PATH, method, params, sessionContext);
        return call.perform().bind(
            (result:StringDictionary)=> {
                return Future.createCompletedFuture<XGetSessionListPropertyResult>("getSessionListProperty/extractResultFromResponse",
                    DialogTriple.fromWSDialogObject<XGetSessionListPropertyResult>(result, 'WSGetSessionListPropertyResult', OType.factoryFn));
            }
        );
    }

    static setSessionListProperty(propertyName:string,
                                  listProperty:Array<string>,
                                  sessionContext:SessionContext):Future<VoidResult> {

        var method = "setSessionListProperty";
        var params:StringDictionary = {
            'propertyName': propertyName,
            'listProperty': listProperty,
            'sessionHandle': sessionContext.sessionHandle
        };
        var call = Call.createCall(SessionService.SERVICE_PATH, method, params, sessionContext);
        return call.perform().bind(
            (result:StringDictionary)=> {
                return Future.createSuccessfulFuture<VoidResult>("setSessionListProperty/extractVoidResultFromResponse", result);
            }
        );
    }
}