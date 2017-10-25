/**
 * Created by rburson on 8/29/17.
 */

import {Client, ClientMode, JsonClientResponse} from "./client";
import {ArrayUtil, DataUrl, DateTimeValue, DateValue, Log, ObjUtil, StringDictionary, TimeValue} from "./util";
import {
    ClientType, Dialog, DialogMessage, DialogRedirection, Login, Menu, PropertyDef, Property, Redirection,
    Session, Tenant, WebRedirection, Workbench, WorkbenchAction, WorkbenchRedirection, CodeRef, ObjectRef,
    GeoFix, GeoLocation, NavRequest, NullNavRequest, RecordDef, DialogMode, View, ViewMode, Form, ErrorMessage,
    DialogException, ViewDesc, Record, EntityBuffer, NullEntityRec, EntityRec, AttributeCellValue, Column, Details,
    List, Map, SessionTypeName, ModelUtil, WebRedirectionTypeName, WorkbenchRedirectionTypeName, QueryDirection,
    QueryDialog, EditorDialog, Filter, Sort
} from "./models";
import {FetchClient} from "./ws";
import {OfflineClient} from "./offline";
import * as moment from 'moment';
import * as numeral from "numeral";

/**
 * Top-level entry point into the Catavolt API
 */
export class AppContext {

    private static _singleton:AppContext;

    private static ONE_HOUR_IN_MILLIS:number = 60 * 60 * 1000;

    //defaults
    private static SERVER_URL:string = 'https://dialog.hxgn-api.net' ;
    private static SERVER_VERSION = 'v0';

    public lastMaintenanceTime:Date = new Date(0);
    private _dialogApi:DialogApi;
    private _session:Session;
    private _devicePropsDynamic:{[index:string]:()=>string;};
    private _devicePropsStatic:{[index:string]:string};


    /* ********************
            Statics
     *********************** */

    /**
     * Get the default session time
     * @returns {number}
     */
    public static get defaultTTLInMillis():number {
        return AppContext.ONE_HOUR_IN_MILLIS;
    }

    /**
     * Get the singleton instance of the AppContext
     * @returns {AppContext}
     */
    static get singleton():AppContext {
        if (!AppContext._singleton) {
            AppContext._singleton = new AppContext(AppContext.SERVER_VERSION, AppContext.SERVER_URL);
        }
        return AppContext._singleton;
    }

    /**
     * Construct an AppContext
     * This should not be called directly, instead use the 'singleton' method
     * @private
     */
    private constructor(serverVersion:string, serverUrl:string) {

        if (AppContext._singleton) {
            throw new Error("Singleton instance already created");
        }
        this._devicePropsStatic = {};
        this._devicePropsDynamic = {};

        this.initDialogApi(serverVersion, serverUrl);

        AppContext._singleton = this;
    }


    /* *****************
        Public Ops
       ******************* */

    /**
     * Add or replace a dynamic device property (func)
     * @param propName
     * @param propFn
     */
    addDynamicDeviceProp(propName:string, propFn:()=>string):void {
        this._devicePropsDynamic[propName] = propFn;
    }

    /**
     * Add or replace a static device property
     *
     * @param propName
     * @param propValue
     */
    addStaticDeviceProp(propName:string, propValue:string):void {
        this._devicePropsStatic[propName] = propValue;
    }

    /**
     * Get the json representation of this client's locale.  The server pulls this value from the agent string
     * and returns it to the client.
     * @returns {string}
     */
    get browserLocaleJson():string {

        return this.session.tenantProperties['browserLocale'];
    }

    /**
     * Get the number of millis that the client will remain active between calls
     * to the server.
     * @returns {number}
     */
    get clientTimeoutMillis():number {
        const mins = this.session.tenantProperties['clientTimeoutMinutes'];
        return mins ? (Number(mins) * 60 * 1000) : AppContext.defaultTTLInMillis;
    }

    /**
     * Get the currency symbol override if defined from the server.
     * @returns {string}
     */
    get currencySymbol():string {
        const currencySymbol = this.session.tenantProperties['currencySymbol'];
        return currencySymbol ? currencySymbol : null;
    }

    /**
     * Get the device props
     * @returns {{[p: string]: string}}
     */
    get deviceProps():{[index:string]:string} {

        const newProps:{[index:string]:string} = ObjUtil.addAllProps(this._devicePropsStatic, {});
        for(const attr in this._devicePropsDynamic) {
           newProps[attr] = this._devicePropsDynamic[attr]();
        }
        return newProps;

    }

    /**
     * Get the DialogApi instance
     * @returns {DialogApi}
     */
    get dialogApi():DialogApi {
        return this._dialogApi;
    }

    /**
     * Get a Workbench by workbenchId
     * @param workbenchId
     * @returns {Promise<Workbench>}
     */
    getWorkbench(workbenchId:string):Promise<Workbench> {

        if (!this.isLoggedIn) {
            return Promise.reject(new Error('User is not logged in'));
        }

        return this.dialogApi.getWorkbench(this.session.tenantId, this.session.id, workbenchId);
    }

    /**
     * Get the list of Workbenches
     *
     * @returns {Array<Workbench>}
     */
    getWorkbenches():Promise<Array<Workbench>> {

        if (!this.isLoggedIn) {
            return Promise.reject(new Error('User is not logged in'));
        }

        return this.dialogApi.getWorkbenches(this.session.tenantId, this.session.id);
    }


    /**
     * Initialize a dialog service implementation for use by this AppContext
     *
     * @param serverVersion
     * @param serverUrl
     */
    initDialogApi(serverVersion:string, serverUrl:string):void {

        this._dialogApi = new DialogService(serverVersion, this.getClient(ClientMode.REMOTE), serverUrl);

    }

    /**
     * Initialize an offline dialog service
     *
     * @param serverVersion
     * @param serverUrl
     */
    initOfflineApi(serverVersion:string, serverUrl:string):void {

        this._dialogApi = new DialogService(serverVersion, this.getClient(ClientMode.OFFLINE), serverUrl);

    }

    /**
     * Check for the availability of the given featureSet
     * @see FeatureSet
     * @param featureSet
     * @returns {boolean}
     */
    isFeatureSetAvailable(featureSet:FeatureSet):boolean {
        try {
            const currentVersion = AppVersion.getAppVersion(this.session.serverVersion);
            const featureMinimumVersion = FeatureVersionMap[featureSet];
            return featureMinimumVersion.isLessThanOrEqualTo(currentVersion);
        } catch(error) {
            Log.error('Failed to compare appVersions for feature ' + featureSet);
            Log.error(error);
            return false;
        }
    }

    /**
     * Checked logged in status
     * @returns {boolean}
     */
    get isLoggedIn() {
        return !!this._session;
    }

    /**
     * Log in and retrieve the Session
     *
     * @param tenantId
     * @param clientType
     * @param userId
     * @param password
     * @param serverUrl
     * @param serverVersion
     *
     * @returns {Promise<Session | Redirection>}
     */
    login(tenantId:string,
          clientType:ClientType,
          userId:string,
          password:string):Promise<Session | Redirection> {

        if (this.isLoggedIn) {
            return Promise.reject(new Error('User is already logged in'));
        }

        const login:Login = {
            userId:userId,
            password: password,
            clientType:clientType,
            deviceProperties:this.deviceProps
        };

        return this.dialogApi.createSession(tenantId, login).then((result:Session | Redirection)=>{
            if(result.type === SessionTypeName) {
                this._session = <Session>result;
                return result;
            } else {
                return result;
            }
        });
    }

    /**
     * Logout and destroy the session
     * @returns {{sessionId:string}}
     */
    logout():Promise<{sessionId:string}> {

        if (!this.isLoggedIn) {
            return Promise.reject('User is already logged out');
        }

        return this.dialogApi.deleteSession(this.session.tenantId, this.session.id).then(result=>{
            this._session = null;
            return result;
        });
    }

    /**
     * Open a redirection
     *
     * @param redirection
     * @param actionSource
     * @returns {Promise<NavRequest>}
     */
    openRedirection(redirection:Redirection):Promise<NavRequest> {
        return this.fromRedirection(redirection);
    }

    /**
     * Open a {@link WorkbenchLaunchAction}
     * @param launchAction
     * @returns {Promise<{actionId:string} | Redirection>}
     */
    performLaunchAction(workbench:Workbench, launchAction:WorkbenchAction):Promise<{actionId:string} | Redirection> {

        return this.performLaunchActionForId(workbench.id, launchAction.id);

    }

    /**
     * Open a {@link WorkbenchLaunchAction}
     * @param workbenchId
     * @param launchActionId
     * @returns {Promise<{actionId:string} | Redirection>}
     */
    performLaunchActionForId(workbenchId:string, launchActionId:string):Promise<{actionId:string} | Redirection> {

        if (!this.isLoggedIn) {
            return Promise.reject(new Error('User is not logged in'));
        }

        return this.dialogApi.performWorkbenchAction(this.session.tenantId, this.session.id, workbenchId, launchActionId);
    }

    /**
     * Refresh the AppContext
     *
     * @returns {Promise<Session>}
     */
    refreshContext(tenantId:string,
                   sessionId:string):Promise<Session> {

        return this.dialogApi.getSession(tenantId, sessionId).then(session=>{
            this._session = session;
            return session;
        });

    }


    /**
     * Time remaining before this session is expired by the server
     * @returns {number}
     */
    get remainingSessionTime():number {
        return this.clientTimeoutMillis - ((new Date()).getTime() - this.dialogApi.lastServiceActivity.getTime());
    }

    /**
     * Get the Session
     * @returns {Session}
     */
    get session():Session {
        return this._session;
    }

    /**
     * Return whether or not the session has expired
     * @returns {boolean}
     */
    get sessionHasExpired():boolean {
        return this.remainingSessionTime < 0;
    }

    /* *****************
       Private Ops
     ******************* */

    //@TODO - add action source to FormContext constructor - it is currently null
    private fromRedirection(redirection:Redirection):Promise<NavRequest> {

        if(redirection.type === 'hxgn.api.dialog.DialogRedirection') {
           return this.dialogApi.getDialog(this.session.tenantId, this.session.id, (<DialogRedirection>redirection).dialogId)
               .then((dialog:Dialog)=>{
                  if(dialog.view instanceof Form) {
                      return new FormContext(dialog.businessClassName, dialog.children, dialog.dialogClassName,
                          dialog.dialogMode, dialog.dialogType, dialog.id, dialog.recordDef, dialog.sessionId, dialog.tenantId,
                          <Form>dialog.view, dialog.viewMode, <DialogRedirection>redirection, null, null, this.session, null);
                  } else {
                      throw new Error(`Unexpected top-level dialog view type: ${dialog.view.type}`);
                  }
               });
        } else if(redirection.type === WebRedirectionTypeName) {
            return Promise.resolve(<WebRedirection>redirection);
        } else if(redirection.type === WorkbenchRedirectionTypeName) {
            return this.getWorkbench((<WorkbenchRedirection>redirection).workbenchId);
        } else {
            return Promise.reject(new Error(`Unrecognized type of Redirection ${ObjUtil.formatRecAttr(redirection)}`));
        }
    }

    private getClient(clientType:ClientMode):Client {
        if(clientType === ClientMode.REMOTE) {
            return new FetchClient();
        } else if(clientType === ClientMode.OFFLINE) {
            return new OfflineClient();
        }
    }

}

/////////////////Begin Dialog Context Classes //////////////////////////////////////////////////////////

/**
 * Top-level class, representing a Catavolt 'Pane' definition.
 * All 'Context' classes have a composite {@link PaneDef} that defines the Pane along with a single record
 * or a list of records.  See {@EntityRecord}
 * Context classes, while similar to {@link PaneDef} and subclasses, contain both the corresponding subtype of pane definition {@link PaneDef}
 * (i.e. describing this UI component, layout, etc.) and also the 'data record(s)' as one or more {@link EntityRec}(s)
 */
export abstract class PaneContext implements Dialog{

    //statics
    private static CHAR_CHUNK_SIZE = 128 * 1000; //size in chars for encoded 'write' operation
    static BINARY_CHUNK_SIZE = 256 * 1024; //size in  byes for 'read' operation

    //private/protected
    private _binaryCache:{ [index:string]:Array<Binary> } = {};
    private _lastRefreshTime:Date = new Date(0);
    protected _settings:StringDictionary = {};
    protected _destroyed:boolean = false;
    private _childrenContexts:Array<PaneContext>;

    constructor(readonly businessClassName:string,
                children: Array<Dialog>,
                readonly dialogClassName:string,
                readonly dialogMode:DialogMode,
                readonly dialogType:string,
                readonly id:string,
                readonly recordDef: RecordDef,
                readonly sessionId:string,
                readonly tenantId: string,
                readonly view: View,
                readonly viewMode: ViewMode,
                readonly dialogRedirection:DialogRedirection,
                readonly paneRef:number,
                readonly parentContext:PaneContext,
                readonly session:Session
    ) {
        this._childrenContexts = this.createChildContexts(children, dialogRedirection);
        this.initialize();
    }

    /**
     * Updates a settings object with the new settings from a 'Navigation'
     * @param initialSettings
     * @param navRequest
     * @returns {StringDictionary}
     */
    static resolveSettingsFromRedirection(initialSettings:StringDictionary,
                                          redirection:Redirection):StringDictionary {

        var result:StringDictionary = ObjUtil.addAllProps(initialSettings, {});
        ObjUtil.addAllProps(redirection.referringDialogProperties, result);
        var destroyed = result['fromDialogDestroyed'];
        if (destroyed) result['destroyed'] = true;
        return result;

    }

    /**
     * Load a Binary property from a record
     * @param propName
     * @param entityRec
     * @returns {any}
     */
    /* @TODO */
     binaryAt(propName:string, entityRec:EntityRec):Promise<Binary> {
         /*
         const prop: Prop = entityRec.propAtName(propName)
         if (prop) {
             if (prop.value instanceof InlineBinaryRef) {
                 const binRef = prop.value as InlineBinaryRef;
                 return Future.createSuccessfulFuture('binaryAt', new EncodedBinary(binRef.inlineData, binRef.settings['mime-type']));
             } else if (prop.value instanceof ObjectBinaryRef) {
                 const binRef = prop.value as ObjectBinaryRef;
                 if (binRef.settings['webURL']) {
                     return Future.createSuccessfulFuture('binaryAt', new UrlBinary(binRef.settings['webURL']));
                 } else {
                     return this.readBinary(propName, entityRec);
                 }
             } else if (typeof prop.value === 'string') {
                 return Future.createSuccessfulFuture('binaryAt', new UrlBinary(prop.value));
             } else {
                 return Future.createFailedFuture<Binary>('binaryAt', 'No binary found at ' + propName);
             }
         } else {
             return Future.createFailedFuture<Binary>('binaryAt', 'No binary found at ' + propName);
         }
         */

         return Promise.resolve(null);
     }

     //to comply with Dialog interface
     get children():Array<Dialog> {
         return this.childrenContexts;
     }

     get childrenContexts():Array<PaneContext> {
        return this._childrenContexts;
     }

    /**
     * Get the dialog alias
     * @returns {any}
     */
    get dialogAlias():string {
        return this.dialogRedirection.dialogProperties['dialogAlias'];
    }

    /**
     * Return the error associated with this pane, if any
     * @returns {any}
     */
    get error():DialogException {
        if(this.hasError) {
            return (this.view as ErrorMessage).exception;
        } else {
            return null;
        }
    }


    /**
     * Find a menu def on this Pane with the given actionId
     * @param actionId
     * @returns {MenuDef}
     */
    findMenuDefAt(actionId:string) {
        return this.view.findMenuDefAt(actionId);
    }

    /**
     * Get a string representation of this property suitable for 'reading'
     * @param propValue
     * @param propName
     * @returns {string}
     */
    formatForRead(prop:Property, propName:string):string {
        return PropFormatter.formatForRead(prop, this.propDefAtName(propName));
    }

    /**
     * Get a string representation of this property suitable for 'writing'
     * @param propValue
     * @param propName
     * @returns {string}
     */
    formatForWrite(prop:Property, propName:string):string {
        return PropFormatter.formatForWrite(prop, this.propDefAtName(propName));
    }

    /**
     * Get the underlying form definition {@link FormDef} for this Pane.
     * If this is not a {@link FormContext} this will be the {@link FormDef} of the owning/parent Form
     * @returns {FormDef}
     */
    get formDef():Form {
        return this.parentContext.formDef;
    }

    /**
     * Returns whether or not this pane loaded properly
     * @returns {boolean}
     */
    get hasError():boolean {
        return this.view instanceof ErrorMessage;
    }

    /**
     * Returns whether or not this Form is destroyed
     * @returns {boolean}
     */
    get isDestroyed():boolean {
        return this._destroyed || this.isAnyChildDestroyed;
    }

    /**
     * Returns whether or not the data in this pane is out of date
     * @returns {boolean}
     */
    get isRefreshNeeded():boolean {
        return this._lastRefreshTime.getTime() < AppContext.singleton.lastMaintenanceTime.getTime();
    }

    /**
     * Get the last time this pane's data was refreshed
     * @returns {Date}
     */
    get lastRefreshTime():Date {
        return this._lastRefreshTime;
    }

    /**
     * @param time
     */
    set lastRefreshTime(time:Date) {
        this._lastRefreshTime = time;
    }

    /**
     * Get the all {@link MenuDef}'s associated with this Pane
     * @returns {Array<MenuDef>}
     */
    get menu():Menu {
        return this.view.menu;
    }

    /**
     * Get the title of this Pane
     * @returns {string}
     */
    get paneTitle():string {
        return this.view.findTitle();
    }

    /**
     * Parses a value to prepare for 'writing' back to the server
     * @param formattedValue
     * @param propName
     * @returns {any}
     */
    parseValue(formattedValue:any, propName:string):any {
        return PropFormatter.parse(formattedValue, this.propDefAtName(propName));
    }

    /**
     * Get the propery definition for a property name
     * @param propName
     * @returns {PropDef}
     */
    propDefAtName(propName:string):PropertyDef {
        return this.recordDef.propDefAtName(propName);
    }

    /**
     * Read all the Binary values in this {@link EntityRec}
     * @param entityRec
     * @returns {Future<Array<Try<Binary>>>}
     */
    /* @TODO */
    readBinaries(record:Record):Promise<Array<Binary>> {
        /*
        return Future.sequence<Binary>(
            this.recordDef.filter((propDef: PropertyDef) => {
                return propDef.isBinaryType
            }).map((propDef: PropertyDef) => {
                return this.readBinary(propDef.name, entityRec);
            })
        );
        */
        return Promise.resolve(null);
     }

    /**
     * Get the all {@link ViewDesc}'s associated with this Form
     * @returns {Array<ViewDesc>}
     */
    /* @TODO */
    get viewDescs():Array<ViewDesc> {
        /* @TODO */
        //return this.form.viewDescs;
        return [];
    }

    /* @TODO */
     writeAttachment(attachment:Attachment):Promise<void> {
         /*
        return DialogService.addAttachment(this.dialogRedirection.dialogHandle, attachment, this.session);
        */
         return Promise.resolve(null);
     }

     //@TODO
     writeAttachments(entityRec:EntityRec):Promise<Array<void>> {
         /*
         return Future.sequence<void>(
             entityRec.props.filter((prop: Prop) => {
                 return prop.value instanceof Attachment;
             }).map((prop: Prop) => {
                 const attachment: Attachment = prop.value as Attachment;
                 return this.writeAttachment(attachment);
             })
         );
         */
         return Promise.resolve(null);
     }


    /**
     * Write all Binary values in this {@link EntityRecord} back to the server
     * @param entityRec
     * @returns {Future<Array<Try<XWritePropertyResult>>>}
     */
    /* @TODO */
     writeBinaries(entityRec:EntityRec):Promise<Array<void>> {
         /*
         return Future.sequence<XWritePropertyResult>(
             entityRec.props.filter((prop: Prop) => {
                 return this.propDefAtName(prop.name).isBinaryType;
             }).map((prop: Prop) => {
                 let writeFuture: Future<XWritePropertyResult> = Future.createSuccessfulFuture<XWritePropertyResult>('startSeq', {} as XWritePropertyResult);
                 if (prop.value) {
                     let ptr: number = 0;
                     const encBin: EncodedBinary = prop.value as EncodedBinary;
                     const data = encBin.data;
                     while (ptr < data.length) {
                         const boundPtr = (ptr: number) => {
                             writeFuture = writeFuture.bind((prevResult) => {
                                 const encSegment: string = (ptr + PaneContext.CHAR_CHUNK_SIZE) <= data.length ? data.substr(ptr, PaneContext.CHAR_CHUNK_SIZE) : data.substring(ptr);
                                 return DialogService.writeProperty(this.paneDef.dialogRedirection.dialogHandle, prop.name, encSegment, ptr != 0, this.session);
                             });
                         }
                         boundPtr(ptr);
                         ptr += PaneContext.CHAR_CHUNK_SIZE;
                     }
                 } else {
                     // This is a delete
                     writeFuture = writeFuture.bind((prevResult) => {
                         return DialogService.writeProperty(this.paneDef.dialogRedirection.dialogHandle, prop.name, null, false, this.sessionContext);
                     });
                 }
                 return writeFuture;
             })
         );
         */
         return Promise.resolve(null);
     }

    //@TODO
    private createChildContexts(children:Array<Dialog>, dialogRedirection:DialogRedirection):Array<PaneContext> {

         return children ? children.map((dialog:Dialog, n:number)=>{ return this.createChildContext(dialog, dialogRedirection, n)}) : [];
    }

    private createChildContext(dialog:Dialog, dialogRedirection:DialogRedirection, paneRef:number) {

        if (dialog.view instanceof List) {

            return new ListContext(dialog.businessClassName, dialog.children, dialog.dialogClassName, dialog.dialogMode,
                dialog.dialogType, dialog.id, dialog.recordDef, dialog.sessionId, dialog.tenantId, dialog.view,
                dialog.viewMode, dialogRedirection, paneRef, this, this.session);

        } else if (dialog.view instanceof Details) {

            return new DetailsContext(dialog.businessClassName, dialog.children, dialog.dialogClassName, dialog.dialogMode,
                dialog.dialogType, dialog.id, dialog.recordDef, dialog.sessionId, dialog.tenantId, dialog.view,
                dialog.viewMode, dialogRedirection, paneRef, this, this.session);

        } else if (dialog.view instanceof Map) {

            return new MapContext(dialog.businessClassName, dialog.children, dialog.dialogClassName, dialog.dialogMode,
                dialog.dialogType, dialog.id, dialog.recordDef, dialog.sessionId, dialog.tenantId, dialog.view,
                dialog.viewMode, dialogRedirection, paneRef, this, this.session);

        } else if (dialog.view instanceof Form) {

            //@TODO add ActionSource to FormContext constructor here
            new FormContext(dialog.businessClassName, dialog.children, dialog.dialogClassName,
                dialog.dialogMode, dialog.dialogType, dialog.id, dialog.recordDef, dialog.sessionId, dialog.tenantId,
                <Form>dialog.view, dialog.viewMode, dialogRedirection, paneRef, this, this.session, null);

        }

    }


    /* @TODO */
    openView(targetViewDesc:ViewDesc): Promise<PaneContext | NavRequest>{ return null; }

    protected abstract getSelectedViewId():Promise<string>;
    protected abstract initialize();

    /**
     * @private
     * @param navRequest
     */
    protected processNavRequestForDestroyed(referringDialogProperties:StringDictionary) {

        var destroyedStr:string = referringDialogProperties['destroyed'];
        if (destroyedStr && destroyedStr.toLowerCase() === 'true') {
            this._destroyed = true;
        }
        var fromDialogDestroyed = referringDialogProperties['fromDialogDestroyed'];
        if (fromDialogDestroyed) {
            this._destroyed = true;
        }
    }

    /* @TODO */
    //should this be abstract?
    protected readBinary(propName:string, entityRec:EntityRec):Promise<Binary> { return null; }

    /**
     * @private
     * @returns {boolean}
     */
    private get isAnyChildDestroyed():boolean {
        return this.childrenContexts.some((paneContext:PaneContext)=> {
            return paneContext.isDestroyed;
        });
    }


}

/**
 * PaneContext Subtype that represents a Catavolt Form Definition
 * A form is a 'container' composed of child panes of various concrete types.
 * A FormContext parallels this design, and contains a list of 'child' contexts
 * See also {@link FormDef}.
 * Context classes, while similar to {@link PaneDef} and subclasses, contain both the corresponding subtype of pane definition {@link PaneDef}
 * (i.e. describing this UI component, layout, etc.) and also the 'data record(s)' as one or more {@link EntityRec}(s)
 */
export class FormContext extends PaneContext implements Dialog, NavRequest {

    constructor(businessClassName:string,
                children: Array<Dialog>,
                dialogClassName:string,
                dialogMode:DialogMode,
                dialogType:string,
                id:string,
                recordDef: RecordDef,
                sessionId:string,
                tenantId: string,
                view: Form,
                viewMode: ViewMode,
                dialogRedirection:DialogRedirection,
                paneRef:number,
                parentContext:PaneContext,
                sessionContext:Session,
                readonly actionSource:ActionSource
    ) {
        super(businessClassName, children, dialogClassName, dialogMode, dialogType, id,
            recordDef, sessionId, tenantId, view, viewMode, dialogRedirection, paneRef, parentContext, sessionContext);
    }

    /**
     * Close this form
     * @returns {Future<VoidResult>}
     */
    /* @TODO */
     close():Promise<VoidResult> {
         /*
        return DialogService.closeEditorModel(this.dialogRedirection.dialogHandle, this.sessionContext);
        */
         return Promise.resolve(null);
     }

    /**
     * Get the underlying Form definition for this FormContext
     * @returns {FormDef}
     */
    get form():Form {
        return this.view as Form;
    }

    /* @TODO */
    openView(targetViewDesc: ViewDesc): Promise<PaneContext | NavRequest> {
        /*
        return DialogService.setSelectedEditorViewId(this.paneDef.dialogHandle, new ViewId(targetViewDesc.viewId), this.sessionContext)
            .bind((setViewResult: XOpenDialogModelResult) => {
                const xOpenEditorResult: XOpenEditorModelResult = setViewResult as XOpenEditorModelResult;
                var ca = new ContextAction('#viewChange', xOpenEditorResult.formRedirection.objectId, this.actionSource);
                return FormContextBuilder.createWithRedirection(xOpenEditorResult.formModel.form.redirection, ca, this.sessionContext)
                    .buildFromOpenForm(xOpenEditorResult, xOpenEditorResult.formModel.form.redirection.isEditor)
                    .map((formContext: FormContext) => {
                        this._destroyed = true;
                        return Either.right<PaneContext, NavRequest>(formContext as NavRequest)
                    });
            });
            */
        return Promise.resolve(null);
    }

    /**
     * Perform the action associated with the given MenuDef on this Form
     * @param menuDef
     * @returns {Future<NavRequest>}
     */
    /* @TODO */
    performMenuAction(menu: Menu): Promise<NavRequest> {
        /*
        return DialogService.performEditorAction(this.paneDef.dialogHandle, menuDef.actionId,
            NullEntityRec.singleton, this.sessionContext).bind((value: Redirection) => {
            var destroyedStr: string = value.fromDialogProperties && value.fromDialogProperties['destroyed'];
            if (destroyedStr && destroyedStr.toLowerCase() === 'true') {
                this._destroyed = true;
            }
            var ca: ContextAction = new ContextAction(menuDef.actionId, this.dialogRedirection.objectId, this.actionSource);
            return NavRequestUtil.fromRedirection(value, ca, this.sessionContext);
        });
        */
        return Promise.resolve(null);
    }

    getSelectedViewId():Promise<string> {
        /* @TODO */
        //return DialogService.getSelectedEditorViewId(this.paneDef.dialogHandle, this.sessionContext);
        return null;
    }

    protected initialize() {
    }
}

export enum EditorState{ READ, WRITE, DESTROYED };


/**
 * PanContext Subtype that represents an 'Editor Pane'.
 * An 'Editor' represents and is backed by a single Record and Record definition.
 * See {@link EntityRec} and {@link RecordDef}.
 * Context classes, while similar to {@link PaneDef} and subclasses, contain both the corresponding subtype of pane definition {@link PaneDef}
 * (i.e. describing this UI component, layout, etc.) and also the 'data record(s)' as one or more {@link EntityRec}(s)
 */
export class EditorContext extends PaneContext {

    private static GPS_ACCURACY = 'com.catavolt.core.domain.GeoFix.accuracy';
    private static GPS_SECONDS = 'com.catavolt.core.domain.GeoFix.seconds';

    private _buffer:EntityBuffer;
    private _editorState:EditorState;
    private _isFirstReadComplete:boolean;

    constructor(businessClassName:string,
                children: Array<Dialog>,
                dialogClassName:string,
                dialogMode:DialogMode,
                dialogType:string,
                id:string,
                recordDef: RecordDef,
                sessionId:string,
                tenantId: string,
                view: View,
                viewMode: ViewMode,
                dialogRedirection:DialogRedirection,
                paneRef:number,
                parentContext:PaneContext,
                session:Session

    ) {
        super(businessClassName, children, dialogClassName, dialogMode, dialogType, id,
            recordDef, sessionId, tenantId, view, viewMode, dialogRedirection, paneRef, parentContext, session);
    }

    /**
     * Get the current buffered record
     * @returns {EntityBuffer}
     */
    get buffer():EntityBuffer {
        if (!this._buffer) {
            this._buffer = new EntityBuffer(NullEntityRec.singleton);
        }
        return this._buffer;
    }

    //@TODO
    changeViewMode(viewMode:ViewMode):Promise<RecordDef> {

        /*return DialogService.changePaneMode(this.paneDef.dialogHandle, paneMode,
         this.sessionContext).bind((changePaneModeResult:XChangePaneModeResult)=> {
         this.putSettings(changePaneModeResult.dialogProps);
         if (this.isDestroyedSetting) {
         this._editorState = EditorState.DESTROYED;
         } else {
         this.entityRecDef = changePaneModeResult.entityRecDef;
         if (this.isReadModeSetting) {
         this._editorState = EditorState.READ;
         } else {
         this._editorState = EditorState.WRITE;
         }
         }
         return Future.createSuccessfulFuture('EditorContext::changePaneMode', this.entityRecDef);
         });
         */
        return Promise.resolve(null);
    }

    destroy():void {
        this._editorState = EditorState.DESTROYED;
    }

    /**
     * Get the associated entity record
     * @returns {EntityRec}
     */
    get entityRec():EntityRec {
        return this._buffer.toEntityRec();
    }

    /**
     * Get the current version of the entity record, with any pending changes present
     * @returns {EntityRec}
     */
    get entityRecNow():EntityRec {
        return this.entityRec;
    }

    /**
     * Get the possible values for a 'constrained value' property
     * @param propName
     * @returns {Future<Array<any>>}
     */
    //@TODO
    getAvailableValues(propName:string):Promise<Array<Object>> {
        /*
         return DialogService.getAvailableValues(this.paneDef.dialogHandle, propName,
         this.buffer.afterEffects(), this.sessionContext).map((valuesResult:XGetAvailableValuesResult)=> {
         return valuesResult.list;
         });
         */
        return Promise.resolve(null);

    }

    /**
     * Returns whether or not this cell definition contains a binary value
     * @param cellValueDef
     * @returns {PropDef|boolean}
     */
    isBinary(cellValue:AttributeCellValue):boolean {
        var propDef = this.propDefAtName(cellValue.propertyName);
        return propDef && (propDef.isBinaryType || (propDef.isURLType && cellValue.isInlineMediaStyle));
    }

    /**
     * Returns whether or not this Editor Pane is destroyed
     * @returns {boolean}
     */
    get isDestroyed():boolean {
        return this._editorState === EditorState.DESTROYED;
    }

    /**
     * Returns whether or not this Editor Pane is requested to be destroyed.  This may be set
     * on a presave action assoicted with an action.
     * @returns {boolean}
     */
    get isDestroyRequested():boolean {
        return this.isDestroyedRequestedSetting;
    }

    /**
     * Returns whether or not the buffers contain valid data via a successful read operation.
     * @returns {boolean}
     */
    get isFirstReadComplete():boolean {
        return this._isFirstReadComplete;
    }

    /**
     * Returns whether or not this Editor is in 'read' mode
     * @returns {boolean}
     */
    get isReadMode():boolean {
        return this._editorState === EditorState.READ;
    }

    /**
     * Returns whether or not this property is read-only
     * @param propName
     * @returns {boolean}
     */
    isReadModeFor(propName:string):boolean {
        if (!this.isReadMode) {
            var propDef = this.propDefAtName(propName);
            return !propDef || !propDef.writeAllowed || !propDef.writeEnabled;
        }
        return true;
    }

    /**
     * Returns whether or not this cell definition contains a binary value that should be treated as a signature control
     * @param cellValueDef
     * @returns {PropDef|boolean}
     */
    isSignature(cellValueDef:AttributeCellValue):boolean {
        var propDef = this.propDefAtName(cellValueDef.propertyName);
        return this.isBinary(cellValueDef) && propDef.isSignatureType;
    }

    /**
     * Returns whether or not this property is 'writable'
     * @returns {boolean}
     */
    get isWriteMode():boolean {
        return this._editorState === EditorState.WRITE;
    }

    //@TODO
    openView(targetViewDesc:ViewDesc): Promise<PaneContext> {
        /*
         return DialogService.setSelectedEditorViewId(this.paneDef.dialogHandle, new ViewId(targetViewDesc.viewId), this.sessionContext)
         .bind((setViewResult:XOpenDialogModelResult)=>{
         return this.updatePaneDef(setViewResult).map((paneDef:PaneDef)=>{ return Either.left(this) });
         });
         */
        return Promise.resolve(null);
    }

    /**
     * Perform the action associated with the given MenuDef on this EditorPane.
     * Given that the Editor could possibly be destroyed as a result of this action,
     * any provided pending writes will be saved if present.
     * @param menuDef
     * @param pendingWrites
     * @returns {Future<NavRequest>}
     */
    //@TODO
    performMenuAction(menu:Menu, pendingWrites:EntityRec):Promise<NavRequest> {

        /*
         return DialogService.performEditorAction(this.paneDef.dialogHandle, menuDef.actionId,
         pendingWrites, this.sessionContext).bind((redirection:Redirection)=> {
         var ca = new ContextAction(menuDef.actionId, this.parentContext.dialogRedirection.objectId,
         this.actionSource);
         return NavRequestUtil.fromRedirection(redirection, ca,
         this.sessionContext).map((navRequest:NavRequest)=> {
         this._settings = PaneContext.resolveSettingsFromNavRequest(this._settings, navRequest);
         if (this.isDestroyedSetting) {
         this._editorState = EditorState.DESTROYED;
         }
         if (this.isRefreshSetting) {
         AppContext.singleton.lastMaintenanceTime = new Date();
         }
         return navRequest;
         });
         });
         */
        return Promise.resolve(null);
    }

    /**
     * Properties whose {@link PropDef.canCauseSideEffects} value is true, may change other underlying values in the model.
     * This method will update those underlying values, given the property name that is changing, and the new value.
     * This is frequently used with {@link EditorContext.getAvailableValues}.  When a value is seleted, other properties
     * available values may change. (i.e. Country, State, City dropdowns)
     * @param propertyName
     * @param value
     * @returns {Future<null>}
     */
    //@TODO
    processSideEffects(propertyName:string, value:any):Promise<void> {

        /*
         var sideEffectsFr:Future<EntityRec> = DialogService.processSideEffects(this.paneDef.dialogHandle,
         this.sessionContext, propertyName, value, this.buffer.afterEffects()).map((changeResult:XPropertyChangeResult)=> {
         return changeResult.sideEffects ? changeResult.sideEffects.entityRec : new NullEntityRec();
         });

         return sideEffectsFr.map((sideEffectsRec:EntityRec)=> {
         var originalProps = this.buffer.before.props;
         var userEffects = this.buffer.afterEffects().props;
         var sideEffects = sideEffectsRec.props;
         sideEffects = sideEffects.filter((prop:Prop)=> {
         return prop.name !== propertyName;
         });
         this._buffer = EntityBuffer.createEntityBuffer(this.buffer.objectId,
         EntityRecUtil.union(originalProps, sideEffects),
         EntityRecUtil.union(originalProps, EntityRecUtil.union(userEffects, sideEffects)));
         return null;
         });
         */
        return Promise.resolve(null);
    }

    /**
     * Read (load) the {@link EntityRec} assocated with this Editor
     * The record must be read at least once to initialize the Context
     * @returns {Future<EntityRec>}
     */
    //@TODO
    read():Promise<EntityRec> {

        /*
         return DialogService.readEditorModel(this.paneDef.dialogHandle,
         this.sessionContext).map((readResult:XReadResult)=> {
         this.entityRecDef = readResult.entityRecDef;
         this._isFirstReadComplete = true;
         return readResult.entityRec;
         }).map((entityRec:EntityRec)=> {
         this.initBuffer(entityRec);
         this.lastRefreshTime = new Date();
         return entityRec;
         });
         */
        return Promise.resolve(null);
    }

    /**
     * Get the requested GPS accuracy
     * @returns {Number}
     */
    requestedAccuracy():number {
        var accuracyStr = this.settings[EditorContext.GPS_ACCURACY];
        return accuracyStr ? Number(accuracyStr) : 500;
    }

    /**
     * Get the requested GPS timeout in seconds
     * @returns {Number}
     */
    requestedTimeoutSeconds():number {
        var timeoutStr = this.settings[EditorContext.GPS_SECONDS];
        return timeoutStr ? Number(timeoutStr) : 30;
    }

    //@TODO
    getSelectedViewId():Promise<string> {
        /*
         return DialogService.getSelectedEditorViewId(this.paneDef.dialogHandle, this.sessionContext);
         */
        return null;
    }

    /**
     * Set the value of a property in this {@link EntityRecord}.
     * Values may be already constructed target types (CodeRef, TimeValue, Date, etc.)
     * or primitives, in which case the values will be parsed and objects constructed as necessary.
     * @param name
     * @param value
     * @returns {any}
     */
    setPropValue(name:string, value:any):any {
        const propDef:PropertyDef = this.propDefAtName(name);
        let parsedValue:any = null;
        if (propDef) {
            parsedValue = (value !== null && value !== undefined) ? this.parseValue(value, propDef.propertyName) : null;
            this.buffer.setValue(propDef.propertyName, parsedValue);
        }
        return parsedValue;
    }

    /**
     * Set a binary property from a string formatted as a 'data url'
     * See {@link https://en.wikipedia.org/wiki/Data_URI_scheme}
     * @param name
     * @param dataUrl
     */
    setBinaryPropWithDataUrl(name:string, dataUrl:string) {
        if (dataUrl) {
            const urlObj: DataUrl = new DataUrl(dataUrl);
            this.setBinaryPropWithEncodedData(name, urlObj.data, urlObj.mimeType);
        } else {
            this.setPropValue(name, null);  // Property is being deleted/cleared
        }
    }

    /**
     * Set a binary property with base64 encoded data
     * @param name
     * @param encodedData
     * @param mimeType
     */
    setBinaryPropWithEncodedData(name:string, encodedData:string, mimeType:string) {
        const propDef:PropertyDef = this.propDefAtName(name);
        if (propDef) {
            const value = new EncodedBinary(encodedData, mimeType);
            this.buffer.setValue(propDef.propertyName, value);
        }
    }

    /**
     * Write this record (i.e. {@link EntityRec}} back to the server
     * @returns {Future<Either<NavRequest, EntityRec>>}
     */
    //@TODO
    write(settings?:StringDictionary):Promise<NavRequest | EntityRec> {

        //let deltaRec:EntityRec = this.buffer.afterEffects();
        /* Write the 'special' props first */

        /*
         return this.writeBinaries(deltaRec).bind((binResult) => {
         return this.writeAttachments(deltaRec).bind((atResult) => {
         /* Remove special property types before writing the actual record */
        /*
         deltaRec = this.removeSpecialProps(deltaRec);
         var result:Future<Either<NavRequest, EntityRec>> = DialogService.writeEditorModel(this.paneDef.dialogRedirection.dialogHandle, deltaRec,
         this.sessionContext, settings).bind<Either<NavRequest, EntityRec>>((either:Either<Redirection,XWriteResult>)=> {
         if (either.isLeft) {
         this._settings = PaneContext.resolveSettingsFromNavRequest(this._settings, either.left);
         var ca = new ContextAction('#write', this.parentContext.dialogRedirection.objectId, this.actionSource);
         return NavRequestUtil.fromRedirection(either.left, ca, this.sessionContext).map((navRequest:NavRequest)=> {
         return Either.left<NavRequest,EntityRec>(navRequest);
         });
         } else {
         var writeResult:XWriteResult = either.right;
         this.putSettings(writeResult.dialogProps);
         this.entityRecDef = writeResult.entityRecDef;
         return Future.createSuccessfulFuture<Either<NavRequest, EntityRec>>('EditorContext::write', Either.right(writeResult.entityRec));
         }
         });

         return result.map((successfulWrite:Either<NavRequest,EntityRec>)=> {
         var now = new Date();
         AppContext.singleton.lastMaintenanceTime = now;
         this.lastRefreshTime = now;
         if (successfulWrite.isLeft) {
         this._settings = PaneContext.resolveSettingsFromNavRequest(this._settings, successfulWrite.left);
         } else {
         this.initBuffer(successfulWrite.right);
         }
         if (this.isDestroyedSetting) {
         this._editorState = EditorState.DESTROYED;
         } else {
         if (this.isReadModeSetting) {
         this._editorState = EditorState.READ;
         }
         }
         return successfulWrite;
         });
         });
         });

         */
        return Promise.resolve(null);

    }

    //Module level methods

    /**
     * @private
     */
    initialize() {
        this._settings = ObjUtil.addAllProps(this.dialogRedirection.dialogProperties, {});
        this._editorState = this.isReadModeSetting ? EditorState.READ : EditorState.WRITE;
        this._buffer = null;
    }

    /**
     * Get this Editor Pane's settings
     * @returns {StringDictionary}
     */
    get settings():StringDictionary {
        return this._settings;
    }

    //protected

    //@TODO
    protected readBinary(propName:string, entityRec:EntityRec):Promise<Binary> {
        /*
         let seq:number = 0;
         let encodedResult:string = '';
         let inProgress:string = '';
         let f:(XReadPropertyResult)=>Future<Binary> = (result:XReadPropertyResult) => {
         if (result.hasMore) {
         inProgress += atob(result.data);  // If data is in multiple loads, it must be decoded/built/encoded
         return DialogService.readEditorProperty(this.paneDef.dialogRedirection.dialogHandle,
         propName, ++seq, PaneContext.BINARY_CHUNK_SIZE, this.sessionContext).bind(f);
         } else {
         if (inProgress) {
         inProgress += atob(result.data);
         encodedResult = btoa(inProgress);
         } else {
         encodedResult = result.data;
         }
         return Future.createSuccessfulFuture<Binary>('readProperty', new EncodedBinary(encodedResult));
         }
         }
         return DialogService.readEditorProperty(this.paneDef.dialogRedirection.dialogHandle,
         propName, seq, PaneContext.BINARY_CHUNK_SIZE, this.sessionContext).bind(f);
         */

        return Promise.resolve(null);
    }

    //Private methods

    private removeSpecialProps(entityRec:EntityRec):EntityRec {
        entityRec.props = entityRec.props.filter((prop:Property)=>{
            /* Remove the Binary(s) as they have been written seperately */
            return !this.propDefAtName(prop.name).isBinaryType;
        }).map((prop:Property)=>{
            /*
             Remove the Attachment(s) (as they have been written seperately) but replace
             the property value with the file name of the attachment prior to writing
             */
            if(prop.value instanceof Attachment) {
                const attachment = prop.value as Attachment;
                return new Property(prop.name, attachment.name, prop.annos);
            } else {
                return prop;
            }
        });
        return entityRec;
    }

    private initBuffer(entityRec:EntityRec) {
        this._buffer = entityRec ? new EntityBuffer(entityRec) : new EntityBuffer(NullEntityRec.singleton);
    }

    private get isDestroyedSetting():boolean {
        var str = this._settings['destroyed'];
        return str && str.toLowerCase() === 'true';
    }

    private get isDestroyedRequestedSetting():boolean {
        var str = this._settings['requestDestroy'];
        return str && str.toLowerCase() === 'true';
    }

    private get isGlobalRefreshSetting():boolean {
        var str = this._settings['globalRefresh'];
        return str && str.toLowerCase() === 'true';
    }

    private get isLocalRefreshSetting():boolean {
        var str = this._settings['localRefresh'];
        return str && str.toLowerCase() === 'true';
    }

    private get isReadModeSetting():boolean {
        var paneMode = this.paneModeSetting;
        return paneMode && paneMode.toLowerCase() === 'read';
    }

    private get isRefreshSetting():boolean {
        return this.isLocalRefreshSetting || this.isGlobalRefreshSetting;
    }

    private get paneModeSetting():string {
        return this._settings['paneMode'];
    }

    private putSetting(key:string, value:any) {
        this._settings[key] = value;
    }

    private putSettings(settings:StringDictionary) {
        ObjUtil.addAllProps(settings, this._settings);
    }

    //@TODO
    /*
     private updatePaneDef(xOpenResult:XOpenDialogModelResult):Promise<View> {

     const activeColDefsFr:Future<XGetActiveColumnDefsResult> = FormContextBuilder.fetchChildActiveColDefs(this.dialogRedirection, this.sessionContext);
     const menuDefsFr:Future<Array<MenuDef>> = FormContextBuilder.fetchChildMenuDefs(this.dialogRedirection, this.sessionContext);

     return Future.sequence<any>([activeColDefsFr, menuDefsFr])
     .bind<PaneDef>((arrayOfTries:Array<Try<any>>)=>{
     var flattenedTry:Try<Array<any>> = FormContextBuilder.getFlattenedResults(arrayOfTries);
     if (flattenedTry.failure) {
     return Future.createCompletedFuture<PaneDef>('FormContextBuilder::buildPaneDefFromDialogModel',
     new Failure<PaneDef>(flattenedTry.failure));
     }
     const activeColDefs:XGetActiveColumnDefsResult = flattenedTry.success[0];
     const menuDefs:Array<MenuDef> = flattenedTry.success[1];
     const paneDef = this.paneDef;

     if(xOpenResult instanceof XOpenEditorModelResult) {
     const editorModelResult:XOpenEditorModelResult = xOpenResult;
     paneDef.entityRecDef = editorModelResult.editorRecordDef;
     paneDef.menuDefs = menuDefs;
     this.initialize();
     }

     return Future.createSuccessfulFuture('EditorContext::updatePaneDef', paneDef);

     });
     }
     */

}


/**
 * Enum to manage query states
 */
enum QueryState { ACTIVE, DESTROYED }

/**
 * PaneContext Subtype that represents a 'Query Pane'.
 * A 'Query' represents and is backed by a list of Records and a single Record definition.
 * See {@link EntityRec} and {@link EntityRecDef}.
 * Context classes, while similar to {@link PaneDef} and subclasses, contain both the corresponding subtype of pane definition {@link PaneDef}
 * (i.e. describing this UI component, layout, etc.) and also the 'data record(s)' as one or more {@link EntityRec}(s)
 */
export class QueryContext extends PaneContext {

    private _lastQueryFr:Promise<QueryResult>;
    private _queryState:QueryState;
    private _scroller:QueryScroller;

    constructor(businessClassName:string,
                children: Array<Dialog>,
                dialogClassName:string,
                dialogMode:DialogMode,
                dialogType:string,
                id:string,
                recordDef: RecordDef,
                sessionId:string,
                tenantId: string,
                view: View,
                viewMode: ViewMode,
                dialogRedirection:DialogRedirection,
                paneRef:number,
                parentContext:PaneContext,
                session:Session

    ) {
        super(businessClassName, children, dialogClassName, dialogMode, dialogType, id,
            recordDef, sessionId, tenantId, view, viewMode, dialogRedirection, paneRef, parentContext, session);
    }

    /**
     * Returns whether or not a column is of a binary type
     * @param columnDef
     * @returns {PropDef|boolean}
     */
    isBinary(column:Column):boolean {
        var propDef = this.propDefAtName(column.propertyName);
        return propDef && (propDef.isBinaryType || (propDef.isURLType && propDef.isInlineMediaStyle));
    }

    destroy():void {
        this._queryState = QueryState.DESTROYED;
    }

    /**
     * Returns whether or not this Query Pane is destroyed
     * @returns {boolean}
     */
    get isDestroyed():boolean {
        return this._queryState === QueryState.DESTROYED;
    }

    /**
     * Get the last query result as a {@link Future}
     * @returns {Future<QueryResult>}
     */
    get lastQueryFr():Promise<QueryResult> {
        return this._lastQueryFr;
    }

    //@TODO
    openView(targetViewDesc:ViewDesc): Promise<PaneContext | NavRequest>{
        /*
         return DialogService.setSelectedQueryViewId(this.paneDef.dialogHandle, new ViewId(targetViewDesc.viewId), this.sessionContext)
         .bind((setViewResult:XOpenDialogModelResult)=>{
         return this.updatePaneDef(setViewResult).map((paneDef:PaneDef)=>{ return Either.left(this); });
         });
         */
        return Promise.resolve(null);
    }

    /**
     * Get the pane mode
     * @returns {string}
     */
    get paneMode():string {
        return this._settings['paneMode'];
    }

    /**
     * Perform this action associated with the given MenuDef on this Pane.
     * The targets array is expected to be an array of object ids.
     * @param menuDef
     * @param targets
     * @returns {Future<NavRequest>}
     */
    //@TODO
    performMenuAction(menu:Menu, targets:Array<string>):Promise<NavRequest> {
        /*
         return DialogService.performQueryAction(this.paneDef.dialogHandle, menuDef.actionId,
         targets, this.sessionContext).bind((redirection:Redirection)=> {
         var target = targets.length > 0 ? targets[0] : null;
         var ca:ContextAction = new ContextAction(menuDef.actionId, target, this.actionSource);
         return NavRequestUtil.fromRedirection(redirection, ca, this.sessionContext);
         }).map((navRequest:NavRequest)=> {
         this._settings = PaneContext.resolveSettingsFromNavRequest(this._settings, navRequest);
         if (this.isDestroyedSetting) {
         this._queryState = QueryState.DESTROYED;
         }
         if (this.isRefreshSetting) {
         AppContext.singleton.lastMaintenanceTime = new Date();
         }
         return navRequest;
         });
         */
        return Promise.resolve(null);
    }

    /**
     * Perform a query
     * Note: {@link QueryScroller} is the preferred way to perform a query.
     * see {@link QueryContext.newScroller} and {@link QueryContext.setScroller}
     * @param maxRows
     * @param direction
     * @param fromObjectId
     * @returns {Future<QueryResult>}
     */
    //@TODO
    query(maxRows:number, direction:QueryDirection, fromObjectId:string):Promise<QueryResult> {
        /*
         return DialogService.queryQueryModel(this.paneDef.dialogHandle, direction, maxRows,
         fromObjectId, this.sessionContext).bind((value:XQueryResult)=> {
         var result = new QueryResult(value.entityRecs, value.hasMore);
         this.lastRefreshTime = new Date();
         return Future.createSuccessfulFuture('QueryContext::query', result);
         });
         */
        return Promise.resolve(null);
    }

    /**
     * Clear the QueryScroller's buffer and perform this query
     * @returns {Future<Array<EntityRec>>}
     */
    refresh():Promise<Array<EntityRec>> {
        return this._scroller.refresh();
    }

    /**
     * Get the associated QueryScroller
     * @returns {QueryScroller}
     */
    get scroller():QueryScroller {
        if (!this._scroller) {
            this._scroller = this.newScroller();
        }
        return this._scroller;
    }

    //@TODO
    getSelectedViewId():Promise<string> {
        /*
         return DialogService.getSelectedQueryViewId(this.paneDef.dialogHandle, this.sessionContext);
         */
        return Promise.resolve(null);
    }

    /**
     * Creates a new QueryScroller with the given values
     * @param pageSize
     * @param firstObjectId
     * @param markerOptions
     * @returns {QueryScroller}
     */
    setScroller(pageSize:number, firstObjectId:string, markerOptions:Array<QueryMarkerOption>) {
        this._scroller = new QueryScroller(this, pageSize, firstObjectId, markerOptions);
        return this._scroller;
    }

    /**
     * Creates a new QueryScroller with default buffer size of 50
     * @returns {QueryScroller}
     */
    newScroller():QueryScroller {
        return this.setScroller(50, null, [QueryMarkerOption.None]);
    }

    /**
     * Get the settings associated with this Query
     * @returns {StringDictionary}
     */
    settings():StringDictionary {
        return this._settings;
    }

    //protected

    //@TODO
    protected readBinary(propName:string, entityRec:EntityRec):Promise<Binary> {
        /*
         let seq:number = 0;
         let encodedResult:string = '';
         let inProgress:string = '';
         let f:(XReadPropertyResult)=>Future<Binary> = (result:XReadPropertyResult) => {
         if (result.hasMore) {
         inProgress += atob(result.data);  // If data is in multiple loads, it must be decoded/built/encoded
         return DialogService.readQueryProperty(this.paneDef.dialogRedirection.dialogHandle,
         propName, entityRec.objectId, ++seq, PaneContext.BINARY_CHUNK_SIZE, this.sessionContext).bind(f);
         } else {
         if (inProgress) {
         inProgress += atob(result.data);
         encodedResult = btoa(inProgress);
         } else {
         encodedResult = result.data;
         }
         return Future.createSuccessfulFuture<Binary>('readProperty', new EncodedBinary(encodedResult));
         }
         }
         return DialogService.readQueryProperty(this.paneDef.dialogRedirection.dialogHandle,
         propName, entityRec.objectId, seq, PaneContext.BINARY_CHUNK_SIZE, this.sessionContext).bind(f);
         */
        return Promise.resolve(null);
    }

    protected initialize() {
    }

    private get isDestroyedSetting():boolean {
        var str = this._settings['destroyed'];
        return str && str.toLowerCase() === 'true';
    }

    private get isGlobalRefreshSetting():boolean {
        var str = this._settings['globalRefresh'];
        return str && str.toLowerCase() === 'true';
    }

    private get isLocalRefreshSetting():boolean {
        var str = this._settings['localRefresh'];
        return str && str.toLowerCase() === 'true';
    }

    private get isRefreshSetting():boolean {
        return this.isLocalRefreshSetting || this.isGlobalRefreshSetting;
    }

    //@TODO
    /*
     private updatePaneDef(xOpenResult:XOpenDialogModelResult):Future<PaneDef> {

     const activeColDefsFr:Future<XGetActiveColumnDefsResult> = FormContextBuilder.fetchChildActiveColDefs(this.dialogRedirection, this.sessionContext);
     const menuDefsFr:Future<Array<MenuDef>> = FormContextBuilder.fetchChildMenuDefs(this.dialogRedirection, this.sessionContext);

     return Future.sequence<any>([activeColDefsFr, menuDefsFr])
     .bind<PaneDef>((arrayOfTries:Array<Try<any>>)=>{
     var flattenedTry:Try<Array<any>> = FormContextBuilder.getFlattenedResults(arrayOfTries);
     if (flattenedTry.failure) {
     return Future.createCompletedFuture<PaneDef>('FormContextBuilder::buildPaneDefFromDialogModel',
     new Failure<PaneDef>(flattenedTry.failure));
     }
     const activeColDefs:XGetActiveColumnDefsResult = flattenedTry.success[0];
     const menuDefs:Array<MenuDef> = flattenedTry.success[1];

     const paneDef = this.paneDef;
     if(xOpenResult instanceof  XOpenQueryModelResult) {
     const queryModelResult:XOpenQueryModelResult = xOpenResult;
     paneDef.entityRecDef = queryModelResult.entityRecDef;
     if(paneDef instanceof ListDef) {
     const listDef:ListDef = paneDef;
     listDef.defaultActionId = queryModelResult.defaultActionId;
     listDef.menuDefs = menuDefs;
     listDef.activeColumnDefs = activeColDefs.columnDefs;
     //reset the scroller (and clear the buffer)
     this.newScroller();
     }
     } else {
     return Future.createFailedFuture<PaneDef>('QueryContext:updatePaneDef', 'Query Views are only support on ListDefs at the moment...')
     }

     return Future.createSuccessfulFuture('QueryContext::updatePaneDef', paneDef);

     });
     }
     */

}

export class QueryResult {

    constructor(public entityRecs:Array<EntityRec>, public hasMore:boolean) {
    }

}
/**
 * *********************************
 */


export class HasMoreQueryMarker extends NullEntityRec {
    static singleton = new HasMoreQueryMarker();
}

export class IsEmptyQueryMarker extends NullEntityRec {
    static singleton = new IsEmptyQueryMarker();
}

export enum QueryMarkerOption {
    None, IsEmpty, HasMore
}

export class QueryScroller {

    private _buffer:Array<EntityRec>;
    private _hasMoreBackward:boolean;
    private _hasMoreForward:boolean;
    private _nextPageFr:Promise<QueryResult>;
    private _prevPageFr:Promise<QueryResult>;
    private _firstResultOid:string;

    constructor(private _context:QueryContext,
                private _pageSize:number,
                private _firstObjectId:string,
                private _markerOptions:Array<QueryMarkerOption> = []) {

        this.clear();

    }

    get buffer():Array<EntityRec> {
        return this._buffer;
    }

    get bufferWithMarkers():Array<EntityRec> {
        var result = ArrayUtil.copy(this._buffer);
        if (this.isComplete) {
            if (this._markerOptions.indexOf(QueryMarkerOption.IsEmpty) > -1) {
                if (this.isEmpty) {
                    result.push(IsEmptyQueryMarker.singleton);
                }
            }
        } else if (this._markerOptions.indexOf(QueryMarkerOption.HasMore) > -1) {
            if (result.length === 0) {
                result.push(HasMoreQueryMarker.singleton);
            } else {
                if (this._hasMoreBackward) {
                    result.unshift(HasMoreQueryMarker.singleton)
                }
                if (this._hasMoreForward) {
                    result.push(HasMoreQueryMarker.singleton);
                }
            }
        }
        return result;
    }

    get context():QueryContext {
        return this._context;
    }

    get firstObjectId():string {
        return this._firstObjectId;
    }

    get hasMoreBackward():boolean {
        return this._hasMoreBackward;
    }

    get hasMoreForward():boolean {
        return this._hasMoreForward;
    }

    get isComplete():boolean {
        return !this._hasMoreBackward && !this._hasMoreForward;
    }

    get isCompleteAndEmpty():boolean {
        return this.isComplete && this._buffer.length === 0;
    }

    get isEmpty():boolean {
        return this._buffer.length === 0;
    }

    //@TODO
    pageBackward():Promise<Array<EntityRec>> {
        /*
         if (!this._hasMoreBackward) {
         return Future.createSuccessfulFuture('QueryScroller::pageBackward', []);
         }
         if (!this._prevPageFr || this._prevPageFr.isComplete) {
         var fromObjectId = this._buffer.length === 0 ? null : this._buffer[0].objectId;
         this._prevPageFr = this._context.query(this._pageSize, QueryDirection.BACKWARD, fromObjectId);
         } else {
         this._prevPageFr = this._prevPageFr.bind((queryResult:QueryResult)=> {
         var fromObjectId = this._buffer.length === 0 ? null : this._buffer[0].objectId;
         return this._context.query(this._pageSize, QueryDirection.BACKWARD, fromObjectId);
         });
         }

         var beforeSize:number = this._buffer.length;

         return this._prevPageFr.map((queryResult:QueryResult)=> {
         var afterSize = beforeSize;
         this._hasMoreBackward = queryResult.hasMore;
         if (queryResult.entityRecs.length > 0) {
         var newBuffer:Array<EntityRec> = [];
         for (var i = queryResult.entityRecs.length - 1; i > -1; i--) {
         newBuffer.push(queryResult.entityRecs[i]);
         }
         this._buffer.forEach((entityRec:EntityRec)=> {
         newBuffer.push(entityRec)
         });
         this._buffer = newBuffer;
         afterSize = this._buffer.length;
         }
         return queryResult.entityRecs;
         });
         */
        return Promise.resolve(null);

    }

    //@TODO
    pageForward():Promise<Array<EntityRec>> {

        /*
         if (!this._hasMoreForward) {
         return Future.createSuccessfulFuture('QueryScroller::pageForward', []);
         }
         if (!this._nextPageFr || this._nextPageFr.isComplete) {
         var fromObjectId = this._buffer.length === 0 ? null : this._buffer[this._buffer.length - 1].objectId;
         this._nextPageFr = this._context.query(this._pageSize, QueryDirection.FORWARD, fromObjectId);
         } else {
         this._nextPageFr = this._nextPageFr.bind((queryResult:QueryResult)=> {
         var fromObjectId = this._buffer.length === 0 ? null : this._buffer[this._buffer.length - 1].objectId;
         return this._context.query(this._pageSize, QueryDirection.FORWARD, fromObjectId);
         });
         }

         var beforeSize:number = this._buffer.length;

         return this._nextPageFr.map((queryResult:QueryResult)=> {
         var afterSize = beforeSize;
         this._hasMoreForward = queryResult.hasMore;
         if (queryResult.entityRecs.length > 0) {
         var newBuffer:Array<EntityRec> = [];
         this._buffer.forEach((entityRec:EntityRec)=> {
         newBuffer.push(entityRec)
         });
         queryResult.entityRecs.forEach((entityRec:EntityRec)=> {
         newBuffer.push(entityRec);
         });
         this._buffer = newBuffer;
         afterSize = this._buffer.length;
         }
         return queryResult.entityRecs;
         });
         */

        return Promise.resolve(null);
    }

    get pageSize():number {
        return this._pageSize;
    }

    //@TODO
    refresh():Promise<Array<EntityRec>> {
        /*
         this.clear();
         return this.pageForward().map((entityRecList:Array<EntityRec>)=> {
         if(entityRecList.length > 0) {
         this._firstResultOid = entityRecList[0].objectId;
         }
         return entityRecList;
         });
         */
        return Promise.resolve(null);
    }

    trimFirst(n:number) {
        var newBuffer = [];
        for (var i = n; i < this._buffer.length; i++) {
            newBuffer.push(this._buffer[i]);
        }
        this._buffer = newBuffer;
        this._hasMoreBackward = true;
    }

    trimLast(n:number) {
        var newBuffer = [];
        for (var i = 0; i < this._buffer.length - n; i++) {
            newBuffer.push(this._buffer[i]);
        }
        this._buffer = newBuffer;
        this._hasMoreForward = true;
    }

    private clear() {
        this._hasMoreBackward = !!this._firstObjectId;
        this._hasMoreForward = true;
        this._buffer = [];
        this._firstResultOid = null;
    }

}

export class ErrorContext extends PaneContext {

    constructor(view: ErrorMessage,
                dialogRedirection: DialogRedirection,
                paneRef: number,
                parentContext: PaneContext,
                session: Session) {

        super(null, null, null, null, null, null, null, null, null,
            view, null, dialogRedirection, paneRef, parentContext, session);

    }

    protected getSelectedViewId():Promise<string> { return Promise.reject('Not implemented') }
    protected initialize() {}
}


/**
 * EditorContext Subtype that represents a 'Details Pane'.
 * A Details Pane is an Editor Pane with the purpose of displaying property values for a single record,
 * usually as names/values in a tabular arrangement.
 * See {@link DetailsDef}, {@link EntityRec} and {@link EntityRecDef}.
 * Context classes, while similar to {@link PaneDef} and subclasses, contain both the corresponding subtype of pane definition {@link PaneDef}
 * (i.e. describing this UI component, layout, etc.) and also the 'data record(s)' as one or more {@link EntityRec}(s)
 */
export class DetailsContext extends EditorContext {

    constructor(businessClassName:string,
                children: Array<Dialog>,
                dialogClassName:string,
                dialogMode:DialogMode,
                dialogType:string,
                id:string,
                recordDef: RecordDef,
                sessionId:string,
                tenantId: string,
                view: Details,
                viewMode: ViewMode,
                dialogRedirection:DialogRedirection,
                paneRef:number,
                parentContext:PaneContext,
                session:Session

    ) {
        super(businessClassName, children, dialogClassName, dialogMode, dialogType, id,
            recordDef, sessionId, tenantId, view, viewMode, dialogRedirection, paneRef, parentContext, session);
    }


    get details():Details {
        return <Details>this.view;
    }
}

/**
 * QueryContext Subtype that represents a 'List Pane'.
 * An 'List' is a type of query backed by a list of Records and a single Record definition, with the
 * purpose of displaying a tabular list of records.
 * See {@link ListDef}, {@link EntityRec} and {@link EntityRecDef}.
 * Context classes, while similar to {@link PaneDef} and subclasses, contain both the corresponding subtype of pane definition {@link PaneDef}
 * (i.e. describing this UI component, layout, etc.) and also the 'data record(s)' as one or more {@link EntityRec}(s)
 */
export class ListContext extends QueryContext {

    constructor(businessClassName:string,
                children: Array<Dialog>,
                dialogClassName:string,
                dialogMode:DialogMode,
                dialogType:string,
                id:string,
                recordDef: RecordDef,
                sessionId:string,
                tenantId: string,
                view: List,
                viewMode: ViewMode,
                dialogRedirection:DialogRedirection,
                paneRef:number,
                parentContext:PaneContext,
                session:Session

    ) {
        super(businessClassName, children, dialogClassName, dialogMode, dialogType, id,
            recordDef, sessionId, tenantId, view, viewMode, dialogRedirection, paneRef, parentContext, session);
    }


    get columnHeadings():Array<string> {
        return this.list.columns.map((c:Column)=> {
            return c.heading;
        });
    }

    get list():List {
        return <List>this.view;
    }

    rowValues(entityRec:EntityRec):Array<any> {
        return this.list.columns.map((c:Column)=> {
            return entityRec.valueAtName(c.propertyName);
        });
    }

    get style():string {
        return this.list.style;
    }

}
/**
 * QueryContext Subtype that represents a 'Map Pane'.
 * A 'Map' is a type of query backed by a list of Records and a single Record definition, with the
 * purpose of displaying an annotated map with location markers.
 * See {@link MapDef}, {@link EntityRec} and {@link EntityRecDef}.
 * Context classes, while similar to {@link PaneDef} and subclasses, contain both the corresponding subtype of pane definition {@link PaneDef}
 * (i.e. describing this UI component, layout, etc.) and also the 'data record(s)' as one or more {@link EntityRec}(s)
 */
export class MapContext extends QueryContext {

    constructor(businessClassName:string,
                children: Array<Dialog>,
                dialogClassName:string,
                dialogMode:DialogMode,
                dialogType:string,
                id:string,
                recordDef: RecordDef,
                sessionId:string,
                tenantId: string,
                view: Map,
                viewMode: ViewMode,
                dialogRedirection:DialogRedirection,
                paneRef:number,
                parentContext:PaneContext,
                session:Session

    ) {
        super(businessClassName, children, dialogClassName, dialogMode, dialogType, id,
            recordDef, sessionId, tenantId, view, viewMode, dialogRedirection, paneRef, parentContext, session);
    }



    get map():Map {
        return <Map>this.view;
    }

}

/*
 ************************** Dialog API ****************************
 */

export interface DialogApi {

    getTenants():Promise<Array<Tenant>>;

    getSessions(tenantId:string):Promise<Array<Session>>;

    createSession(tenantId:string, login:Login):Promise<Session | Redirection>;

    getSession(tenantId:string, sessionId:string):Promise<Session>;

    deleteSession(tenantId:string, sessionId:string):Promise<{sessionId:string}>;

    getWorkbenches(tenantId:string, sessionId:string):Promise<Array<Workbench>>;

    getWorkbench(tenantId:string, sessionId:string, workbenchId:string):Promise<Workbench>;

    getDialogs(tenantId:string, sessionId:string):Promise<Array<Dialog>>;

    getDialog(tenantId:string, sessionId:string, dialogId:string):Promise<Dialog>;

    deleteDialog(tenantId:string, sessionId:string, dialogId:string):Promise<{dialogId:string}>;

    getActions(tenantId:string, sessionId:string, dialogId:string):Promise<Array<Menu>>;

    performAction(tenantId:string, sessionId:string, dialogId:string, actionId:string):Promise<{actionId:string} | Redirection>;

    getWorkbenchActions(tenantId:string, sessionId:string, workbenchId:string):Promise<Array<WorkbenchAction>>;

    performWorkbenchAction(tenantId:string, sessionId:string, workbenchId:string, actionId:string):Promise<{actionId:string} | Redirection>;

    getRecord(tenantId:string, sessionId:string, dialogId:string):Promise<Record>;

    putRecord(tenantId:string, sessionId:string, dialogId:string, record:Record):Promise<Record | Redirection>;

    getRecords(tenantId:string, sessionId:string, dialogId:string, fetchDirection:QueryDirection,
               fetchMaxItems:number):Promise<Array<Record>>;

    getMode(tenantId:string, sessionId:string, dialogId:string):Promise<ViewMode>;

    changeMode(tenantId:string, sessionId:string, dialogId:string, mode:DialogMode):Promise<EditorDialog>;

    getView(tenantId:string, sessionId:string, dialogId:string):Promise<View>;

    changeView(tenantId:string, sessionId:string, dialogId:string, view:View):Promise<Dialog>;

    getViews(tenantId:string, sessionId:string, dialogId:string):Promise<Array<View>>;

    getColumns(tenantId:string, sessionId:string, dialogId:string):Promise<Array<Column>>;

    changeColumns(tenantId:string, sessionId:string, dialogId:string, columns:Array<Column>):Promise<QueryDialog>;

    getListFilter(tenantId:string, sessionId:string, dialogId:string):Promise<Filter>;

    changeListFilter(tenantId:string, sessionId:string, dialogId:string, filter:Filter):Promise<QueryDialog>;

    getListSort(tenantId:string, sessionId:string, dialogId:string):Promise<Sort>;

    changeListSort(tenantId:string, sessionId:string, dialogId:string, sort:Sort):Promise<QueryDialog>;

    lastServiceActivity:Date;

}

export class DialogService implements DialogApi {

    private static SERVER:string = 'https://dialog.hxgn-api.net' ;

    readonly baseUrl:string;

    constructor(readonly apiVersion:string='v0', readonly client:Client, serverUrl=DialogService.SERVER) {
        this.baseUrl = `${serverUrl}/${apiVersion}`;
    }

    getTenants():Promise<Array<Tenant>>{

        return this.get('tenants').then(
            jsonClientResponse=>(new DialogServiceResponse<Array<Tenant>>(jsonClientResponse)).responseValue()
        );

    }

    getSessions(tenantId:string):Promise<Array<Session>> {

        return this.get(`tenants/${tenantId}/sessions`).then(
            jsonClientResponse=>(new DialogServiceResponse<Array<Session>>(jsonClientResponse)).responseValue()
        );

    }

    createSession(tenantId:string, login:Login):Promise<Session | Redirection> {

        return this.post(`tenants/${tenantId}/sessions`, login).then(
            jsonClientResponse=>(new DialogServiceResponse<Session>(jsonClientResponse)).responseValueOrRedirect()
        );

    }

    getSession(tenantId:string, sessionId:string):Promise<Session> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}`).then(
            jsonClientResponse=>(new DialogServiceResponse<Session>(jsonClientResponse)).responseValue()
        );

    }

    deleteSession(tenantId:string, sessionId:string):Promise<{sessionId:string}> {

        return this.d3lete(`tenants/${tenantId}/sessions/${sessionId}`).then(
            jsonClientResponse=>(new DialogServiceResponse<{sessionId:string}>(jsonClientResponse)).responseValue()
        );

    }

    getWorkbenches(tenantId:string, sessionId:string):Promise<Array<Workbench>> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/workbenches`).then(
            jsonClientResponse=>(new DialogServiceResponse<Array<Workbench>>(jsonClientResponse)).responseValue()
        );

    }

    getWorkbench(tenantId:string, sessionId:string, workbenchId:string):Promise<Workbench> {

        return this.get(`tenants/{$tenantId}/sessions/{$sessionId}/workbenches/{$workbenchId}`).then(
            jsonClientResponse=>(new DialogServiceResponse<Workbench>(jsonClientResponse)).responseValue()
        );

    }

    getDialogs(tenantId:string, sessionId:string):Promise<Array<Dialog>> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/dialogs`).then(
            jsonClientResponse=>(new DialogServiceResponse<Array<Dialog>>(jsonClientResponse)).responseValue()
        );

    }

    getDialog(tenantId:string, sessionId:string, dialogId:string):Promise<Dialog> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}`).then(
            jsonClientResponse=>(new DialogServiceResponse<Dialog>(jsonClientResponse)).responseValue()
        );

    }

    deleteDialog(tenantId:string, sessionId:string, dialogId:string):Promise<{dialogId:string}> {

        return this.d3lete(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}`).then(
            jsonClientResponse=>(new DialogServiceResponse<{dialogId:string}>(jsonClientResponse)).responseValue()
        );

    }

    getActions(tenantId:string, sessionId:string, dialogId:string):Promise<Array<Menu>> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/actions`).then(
            jsonClientResponse=>(new DialogServiceResponse<Array<Menu>>(jsonClientResponse)).responseValue()
        );

    }

    performAction(tenantId:string, sessionId:string, dialogId:string, actionId:string):Promise<{actionId:string} | Redirection> {

        return this.post(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/actions/${actionId}`, {}).then(
            jsonClientResponse=>(new DialogServiceResponse<{actionId:string}>(jsonClientResponse)).responseValueOrRedirect()
        );

    }

    getWorkbenchActions(tenantId:string, sessionId:string, workbenchId:string):Promise<Array<WorkbenchAction>> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/workbenches/${workbenchId}/actions`).then(
            jsonClientResponse=>(new DialogServiceResponse<Array<WorkbenchAction>>(jsonClientResponse)).responseValue()
        );

    }

    performWorkbenchAction(tenantId:string, sessionId:string, workbenchId:string, actionId:string):Promise<{actionId:string} | Redirection> {

        return this.post(`tenants/${tenantId}/sessions/${sessionId}/workbenches/${workbenchId}/actions/${actionId}`, {}).then(
            jsonClientResponse=>(new DialogServiceResponse<{actionId:string}>(jsonClientResponse)).responseValueOrRedirect()
        );

    }

    getRecord(tenantId:string, sessionId:string, dialogId:string):Promise<Record> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/record`).then(
            jsonClientResponse=>(new DialogServiceResponse<Record>(jsonClientResponse)).responseValue()
        );

    }

     putRecord(tenantId:string, sessionId:string, dialogId:string, record:Record):Promise<Record | Redirection> {

         return this.put(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/record}`, record).then(
             jsonClientResponse=>(new DialogServiceResponse<Record | Redirection>(jsonClientResponse)).responseValueOrRedirect()
         );
     }

     getRecords(tenantId:string, sessionId:string, dialogId:string, fetchDirection:QueryDirection,
                fetchMaxItems:number):Promise<Array<Record>> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/records`,
            {fetchDirection:fetchDirection, fetchMaxItems:fetchMaxItems}).then(
                jsonClientResponse=>(new DialogServiceResponse<Array<Record>>(jsonClientResponse)).responseValue()
         );
    }

    getMode(tenantId:string, sessionId:string, dialogId:string):Promise<ViewMode> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/viewMode`).then(
            jsonClientResponse=>(new DialogServiceResponse<ViewMode>(jsonClientResponse)).responseValue()
        );
    }

    changeMode(tenantId:string, sessionId:string, dialogId:string, mode:DialogMode):Promise<EditorDialog> {

        return this.put(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/viewMode/${mode}`).then(
            jsonClientResponse=>(new DialogServiceResponse<EditorDialog>(jsonClientResponse)).responseValue()
        );

    }

     getView(tenantId:string, sessionId:string, dialogId:string):Promise<View> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/view`).then(
             jsonClientResponse=>(new DialogServiceResponse<View>(jsonClientResponse)).responseValue()
         );

     }

     //@TODO
     //this should probably take a view id instead of a view
     changeView(tenantId:string, sessionId:string, dialogId:string, view:View):Promise<Dialog> {

        return this.put(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/view`, view).then(
             jsonClientResponse=>(new DialogServiceResponse<Dialog>(jsonClientResponse)).responseValue()
         );

     }

     getViews(tenantId:string, sessionId:string, dialogId:string):Promise<Array<View>> {

         return this.get(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/views`).then(
             jsonClientResponse=>(new DialogServiceResponse<Array<View>>(jsonClientResponse)).responseValue()
         );

    }

    getColumns(tenantId:string, sessionId:string, dialogId:string):Promise<Array<Column>> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/columns`).then(
            jsonClientResponse=>(new DialogServiceResponse<Array<Column>>(jsonClientResponse)).responseValue()
        );

    }

    changeColumns(tenantId:string, sessionId:string, dialogId:string, columns:Array<Column>):Promise<QueryDialog> {

        return this.put(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/view`, columns).then(
            jsonClientResponse=>(new DialogServiceResponse<QueryDialog>(jsonClientResponse)).responseValue()
        );

    }

    getListFilter(tenantId:string, sessionId:string, dialogId:string):Promise<Filter> {

       return this.get(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/filter`).then(
           jsonClientResponse=>(new DialogServiceResponse<Filter>(jsonClientResponse)).responseValue()
       );

    }

    changeListFilter(tenantId:string, sessionId:string, dialogId:string, filter:Filter):Promise<QueryDialog> {

         return this.put(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/filter`, filter).then(
             jsonClientResponse=>(new DialogServiceResponse<QueryDialog>(jsonClientResponse)).responseValue()
         );

    }

    getListSort(tenantId:string, sessionId:string, dialogId:string):Promise<Sort> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/sort`).then(
            jsonClientResponse=>(new DialogServiceResponse<Sort>(jsonClientResponse)).responseValue()
        );

    }

    changeListSort(tenantId:string, sessionId:string, dialogId:string, sort:Sort):Promise<QueryDialog> {

        return this.put(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/sort`, sort).then(
            jsonClientResponse=>(new DialogServiceResponse<QueryDialog>(jsonClientResponse)).responseValue()
        );

    }


    get lastServiceActivity():Date {
        return this.client.lastActivity;
    }


    /* Private methods */

    private get(path:string, queryParams?:StringDictionary):Promise<JsonClientResponse> {
        return this.client.getJson(`${DialogService.SERVER}/${this.apiVersion}`, path, queryParams);
    }

    private post<T>(path:string, body?:T):Promise<JsonClientResponse> {
        return this.client.postJson(`${DialogService.SERVER}/${this.apiVersion}`, path, body);
    }

    private d3lete(path:string):Promise<JsonClientResponse> {
        return this.client.deleteJson(`${DialogService.SERVER}/${this.apiVersion}`, path);
    }

    private put<T>(path:string, body?:T):Promise<JsonClientResponse> {
        return this.client.putJson(`${DialogService.SERVER}/${this.apiVersion}`, path, body);
    }

}

export interface DialogApiResponse<T> {

    responseValue():Promise<T>;
    responseValueOrRedirect():Promise<T | Redirection>;
    assertNoError():Promise<void>;

}

export class DialogServiceResponse<T> implements DialogApiResponse<T> {

    constructor(private readonly clientResponse:JsonClientResponse){}

    responseValue():Promise<T> {
        return new Promise((resolve, reject)=> {
            if(this.hasMessage) {
                reject(<DialogMessage>this.clientResponse.value);
            } else {
                this.fullfillJsonToModel<T>(this.clientResponse, resolve, reject);
            }
        });
    }

    responseValueOrRedirect():Promise<T | Redirection> {
        return new Promise((resolve, reject)=> {
            if(this.hasMessage) {
                reject(<DialogMessage>this.clientResponse.value);
            } else if(this.hasValue) {
                this.fullfillJsonToModel<T>(this.clientResponse, resolve, reject);
            } else {
                this.fullfillJsonToModel<Redirection>(this.clientResponse, resolve, reject);
            }
        });
    }

    assertNoError():Promise<void> {
        return new Promise((resolve, reject)=> {
            if(this.hasMessage) {
                reject(<DialogMessage>this.clientResponse.value);
            } else {
                resolve(undefined);
            }
        });
    }

    get hasValue():boolean {
        return this.clientResponse.statusCode >= 200 && this.clientResponse.statusCode < 300;
    }

    get hasRedirection():boolean {
        return this.clientResponse.statusCode >= 300 && this.clientResponse.statusCode < 400;
    }

    get hasMessage():boolean {
        return this.clientResponse.statusCode >= 400;
    }

    private fullfillJsonToModel<T>(clientResponse:JsonClientResponse, resolve, reject):void {

        ModelUtil.jsonToModel<T>(this.clientResponse.value).then(resolve).catch(reject);
    }

}

/**
 *****************************************************
 */

/* Begin Feature Versioning */

class AppVersion {

    public static getAppVersion(versionString:string):AppVersion {
        const [major, minor, patch] = versionString.split('.');
        return new AppVersion(Number(major || 0), Number(minor || 0), Number(patch || 0));
    }

    constructor(public major:number, public minor:number, public patch:number){}

    /**
     * Is 'this' version less than or equal to the supplied version?
     * @param anotherVersion - the version to compare to 'this' version
     * @returns {boolean}
     */
    public isLessThanOrEqualTo(anotherVersion:AppVersion):boolean {

        if(anotherVersion.major > this.major) {
            return true;
        } else if(anotherVersion.major == this.major) {
            if(anotherVersion.minor > this.minor) {
                return true;
            } else if(anotherVersion.minor == this.minor){
                return anotherVersion.patch >= this.patch;
            } else {
                return false;
            }
        } else {
            return false;
        }

    }
}

/**
 * Available Features
 */
export type FeatureSet = "View_Support" | "Unified_Search"

/* Map features to minimum app versions */
const FeatureVersionMap:{[featureSet:string]:AppVersion} = {
    "View_Support": AppVersion.getAppVersion("1.3.447"),
    "Unified_Search": AppVersion.getAppVersion("1.3.463")
};

/* End Feature Versioning */


/**
 * ************* Dialog Support Classes ********************
 */

export interface ActionSource {

    fromActionSource:ActionSource;
    virtualPathSuffix:Array<string>;

}

export class ContextAction implements ActionSource {

    constructor(public actionId:string,
                public objectId:string,
                public fromActionSource:ActionSource) {
    }

    get virtualPathSuffix():Array<string> {
        return [this.objectId, this.actionId];
    }
}

export interface VoidResult {
}


/**
 * ************* Binary Support ********************
 */

/**
 * Represents a binary value
 */
export interface Binary {

    /**
     * Return a url resprenting this binary value
     */
    toUrl():string;
}

/**
 * Represents a base64 encoded binary
 */
export class EncodedBinary implements Binary {

    constructor(private _data:string, private _mimeType?:string) {
    }

    /**
     * Get the base64 encoded data
     * @returns {string}
     */
    get data():string {
        return this._data;
    }

    /**
     * Get the mime-type
     * @returns {string|string}
     */
    get mimeType():string {
        return this._mimeType || 'application/octet-stream';
    }

    /**
     * Returns a 'data url' representation of this binary, including the encoded data
     * @returns {string}
     */
    toUrl():string {
        return DataUrl.createDataUrl(this.mimeType, this.data);
    }
}

/**
 * Represents a remote binary
 */
export class UrlBinary implements Binary {

    constructor(private _url:string) {
    }

    get url():string {
        return this._url;
    }

    /**
     * Returns a url that 'points to' the binary data
     * @returns {string}
     */
    toUrl():string {
        return this.url;
    }
}


export class Attachment {

    constructor(public name:string, public attachmentData:any) {};

}

/**
 * ************* Property Formatting ********************
 */

/**
 * Helper for transforming values to and from formats suitable for reading and writing to the server
 * (i.e. object to string and string to object)
 */
class PrivatePropFormats {
    static decimalFormat: string[] = ["0,0", "0,0.0", "0,0.00", "0,0.000", "0,0.0000", "0,0.00000", "0,0.000000", "0,0.0000000", "0,0.00000000", "0,0.000000000", "0,0.0000000000"];
    static decimalFormatGeneric:string = "0,0.[0000000000000000000000000]";
    static moneyFormat: string[] = ["$0,0", "$0,0.0", "$0,0.00", "$0,0.000", "$0,0.0000", "$0,0.00000", "$0,0.000000", "$0,0.0000000", "$0,0.00000000", "$0,0.000000000", "$0,0.0000000000"];
    static moneyFormatGeneric:string = "$0,0.[0000000000000000000000000]";
    static percentFormat: string[] = ["0,0%", "0,0%", "0,0%", "0,0.0%", "0,0.00%", "0,0.000%", "0,0.0000%", "0,0.00000%", "0,0.000000%", "0,0.0000000%", "0,0.00000000%"];
    static percentFormatGeneric:string = "0,0.[0000000000000000000000000]%";
    static wholeFormat:string = "0,0";
}

export class PropFormatter {
    // For numeral format options, see: http://numeraljs.com/

    // Default format for money at varying decimal lengths.
    static decimalFormat: string[] = PrivatePropFormats.decimalFormat.slice(0);
    static decimalFormatGeneric:string = PrivatePropFormats.decimalFormatGeneric;
    static moneyFormat: string[] = PrivatePropFormats.moneyFormat.slice(0);
    static moneyFormatGeneric:string = PrivatePropFormats.moneyFormatGeneric;
    static percentFormat: string[] = PrivatePropFormats.percentFormat.slice(0);
    static percentFormatGeneric:string = PrivatePropFormats.decimalFormatGeneric;
    static wholeFormat:string = PrivatePropFormats.wholeFormat;

    /**
     * Get a string representation of this property suitable for 'reading'
     * @param prop
     * @param propDef
     * @returns {string}
     */
    static formatForRead(prop:Property, propDef:PropertyDef):string {
        if (prop === null || prop === undefined){
            return '';
        } else {
            return PropFormatter.formatValueForRead(prop.value, propDef);
        }
    }

    static formatValueForRead(value: any, propDef:PropertyDef) {
        if(value === null || value === undefined) {
            return '';
        } else if ((propDef && propDef.isCodeRefType) || value instanceof CodeRef) {
            return (value as CodeRef).description;
        } else if ((propDef && propDef.isObjRefType) || value instanceof ObjectRef) {
            return (value as ObjectRef).description;
        }else if ((propDef && propDef.isDateTimeType)) {
            return (value as Date).toString();
        } else if ((propDef && propDef.isDateType) || value instanceof Date) {
            return (value as Date).toLocaleDateString();
        } else if ((propDef && propDef.isTimeType) || value instanceof TimeValue) {
            const timeValue:TimeValue = value as TimeValue;
            return moment(timeValue).format("LT");
        } else if ((propDef && propDef.isPasswordType)) {
            return (value as string).replace(/./g, "*");
        } else if ((propDef && propDef.isListType) || Array.isArray(value)) {
            return value.reduce((prev, current)=> {
                return ((prev ? prev + ', ' : '') + PropFormatter.formatValueForRead(current, null));
            }, '');
        } else {
            return PropFormatter.toString(value, propDef);
        }
    }

    /**
     * Get a string representation of this property suitable for 'writing'
     * @param prop
     * @param propDef
     * @returns {string}
     */
    static formatForWrite(prop:Property, propDef:PropertyDef):string {
        if (prop === null || prop === undefined
            || prop.value === null || prop.value === undefined){
            return null;
        } else if ((propDef && propDef.isCodeRefType) || prop.value instanceof CodeRef) {
            return (prop.value as CodeRef).description;
        } else if ((propDef && propDef.isObjRefType) || prop.value instanceof ObjectRef) {
            return (prop.value as ObjectRef).description;
        } else {
            return PropFormatter.toStringWrite(prop.value, propDef);
        }
    }

    /**
     * Attempt to construct (or preserve) the appropriate data type given primitive (or already constructed) value.
     * @param value
     * @param propDef
     * @returns {any}
     */
    static parse(value:any, propDef:PropertyDef) {

        var propValue:any = value;
        if (propDef.isDecimalType) {
            propValue = Number(value);
        } else if (propDef.isLongType) {
            propValue = Number(value);
        } else if (propDef.isBooleanType) {
            if (typeof value === 'string') {
                propValue = value !== 'false';
            } else {
                propValue = !!value;
            }

        } else if (propDef.isDateType) {
            //this could be a DateValue, a Date, or a string
            if(value instanceof DateValue) {
                propValue = value;
            }else if(typeof value === 'object') {
                propValue = new DateValue(value);
            } else {
                //parse as local time
                propValue = new DateValue(moment(value).toDate());
            }
        } else if (propDef.isDateTimeType) {
            //this could be a DateTimeValue, a Date, or a string
            if(value instanceof DateTimeValue) {
                propValue = value;
            }else if(typeof value === 'object') {
                propValue = new DateTimeValue(value);
            } else {
                //parse as local time
                propValue = new DateTimeValue(moment(value).toDate());
            }
        } else if (propDef.isTimeType) {
            propValue = value instanceof TimeValue ? value : TimeValue.fromString(value);
        } else if (propDef.isObjRefType) {
            propValue = value instanceof ObjectRef ? value : ObjectRef.fromFormattedValue(value);
        } else if (propDef.isCodeRefType) {
            propValue = value instanceof CodeRef ? value : CodeRef.fromFormattedValue(value);
        } else if (propDef.isGeoFixType) {
            propValue = value instanceof GeoFix ? value : GeoFix.fromFormattedValue(value);
        } else if (propDef.isGeoLocationType) {
            propValue = value instanceof GeoLocation ? value : GeoLocation.fromFormattedValue(value);
        }
        return propValue;
    }

    static resetFormats():void {
        PropFormatter.decimalFormat = PrivatePropFormats.decimalFormat.slice(0);
        PropFormatter.decimalFormatGeneric = PrivatePropFormats.decimalFormatGeneric;
        PropFormatter.moneyFormat = PrivatePropFormats.moneyFormat.slice(0);
        PropFormatter.moneyFormatGeneric = PrivatePropFormats.moneyFormatGeneric;
        PropFormatter.percentFormat = PrivatePropFormats.percentFormat.slice(0);
        PropFormatter.percentFormatGeneric = PrivatePropFormats.decimalFormatGeneric;
        PropFormatter.wholeFormat = PrivatePropFormats.wholeFormat;
    }

    static toString(o: any, propDef: PropertyDef): string {
        return PropFormatter.toStringRead(o, propDef);
    }

    /**
     * Render this value as a string
     * @param o
     * @param propDef
     * @returns {any}
     */
    static toStringRead(o: any, propDef: PropertyDef): string {
        if (typeof o === 'number') {
            if (propDef && propDef.semanticType !== "DATA_UNFORMATTED_NUMBER") {
                if (propDef.isMoneyType) {
                    let f = propDef.displayScale < this.moneyFormat.length ? this.moneyFormat[propDef.displayScale] : this.moneyFormatGeneric;
                    // If there is a currency symbol, remove it noting it's position pre/post
                    // Necesary because numeral will replace $ with the symbol based on the locale of the browser.
                    // This may be desired down the road, but for now, the server provides the symbol to use.
                    let atStart:boolean = f.length > 0 && f[0] === '$';
                    let atEnd:boolean = f.length > 0 && f[f.length-1] === '$';
                    if (AppContext.singleton.currencySymbol) {
                        f = f.replace("$", "");               // Format this as a number, and slam in Extender currency symbol
                        var formatted = numeral(o).format(f);
                        if (atStart) formatted = AppContext.singleton.currencySymbol + formatted;
                        if (atEnd) formatted = formatted + AppContext.singleton.currencySymbol;
                    } else {
                        formatted = numeral(o).format(f);  // Should substitute browsers locale currency symbol
                    }
                    return formatted;
                } else if (propDef.isPercentType) {
                    let f = propDef.displayScale < this.percentFormat.length ? this.percentFormat[propDef.displayScale] : this.percentFormatGeneric;
                    return numeral(o).format(f);  // numeral accomplishs * 100, relevant if we use some other symbol
                } else if (propDef.isIntType || propDef.isLongType) {
                    return numeral(o).format(this.wholeFormat);
                } else if (propDef.isDecimalType || propDef.isDoubleType) {
                    let f = propDef.displayScale < this.decimalFormat.length ? this.decimalFormat[propDef.displayScale] : this.decimalFormatGeneric;
                    return numeral(o).format(f);
                }
            } else {
                return String(o);
            }
        } else if (typeof o === 'object') {
            if (o instanceof Date) {
                return o.toISOString();
            } else if (o instanceof DateValue) {
                return (o as DateValue).dateObj.toISOString();
            } else if (o instanceof DateTimeValue) {
                return (o as DateTimeValue).dateObj.toISOString();
            } else if (o instanceof TimeValue) {
                return o.toString();
            } else if (o instanceof CodeRef) {
                return o.toString();
            } else if (o instanceof ObjectRef) {
                return o.toString();
            } else if (o instanceof GeoFix) {
                return o.toString();
            } else if (o instanceof GeoLocation) {
                return o.toString();
            } else {
                return String(o);
            }
        } else {
            return String(o);
        }
    }

    static toStringWrite(o: any, propDef: PropertyDef): string {
        if (typeof o === 'number' && propDef) {
            let s = numeral(100);
            if (propDef.isMoneyType) {
                return o.toFixed(2);
            } else if (propDef.isIntType || propDef.isLongType) {
                return o.toFixed(0);
            } else if (propDef.isDecimalType || propDef.isDoubleType) {
                return o.toFixed(Math.max(2, (o.toString().split('.')[1] || []).length));
            }
        } else {
            return PropFormatter.toStringRead(o, propDef);
        }
    }

}





