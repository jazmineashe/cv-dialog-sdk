import {BlobClientResponse} from "../client/BlobClientResponse";
import {JsonClientResponse} from "../client/JsonClientResponse";
import {TextClientResponse} from "../client/TextClientResponse";
import {VoidClientResponse} from "../client/VoidClientResponse";
import {StreamProducer} from '../io/StreamProducer';
import {ActionParametersState} from "../proxy/ActionParametersState";
import {DialogDelegate} from "../proxy/DialogDelegate";
import {DialogProxyTools} from "../proxy/DialogProxyTools";
import {RecordSetState} from "../proxy/RecordSetState";
import {SessionState} from "../proxy/SessionState";
import {Log} from '../util/Log';
import {StringDictionary} from '../util/StringDictionary';
import {SdaGetBriefcaseDialogJsonSample} from "./samples/SdaGetBriefcaseDialogJsonSample";
import {SdaPostBriefcaseWorkbenchActionJsonSample} from "./samples/SdaPostBriefcaseWorkbenchActionJsonSample";
import {SdaDialogDelegateState} from "./SdaDialogDelegateState";
import {SdaDialogDelegateTools} from "./SdaDialogDelegateTools";
import {SdaSelectedWorkPackageState} from "./SdaSelectedWorkPackageState";
import {SdaWorkPackagesState} from "./SdaWorkPackagesState";

export class SdaDialogDelegate implements DialogDelegate {

    private _delegateState: SdaDialogDelegateState = null;
    private _lastActivity: Date = new Date();

    get lastActivity(): Date {
        return this._lastActivity;
    }

    public initialize(): Promise<void> {
        Log.info("SdaDialogDelegate::initialize -- nothing to initialize");
        return Promise.resolve();
    }

    public addWorkPackageToBriefcase(baseUrl: string, resourcePathElems: string[], body?: StringDictionary): Promise<JsonClientResponse> {
        const thisMethod = 'SdaDialogDelegate::addWorkPackageToBriefcase';
        // REQUIRED: Before we can add a Work Package to the briefcase, we must be online
        if (!this.online()) {
            const dialogMessage = DialogProxyTools.constructDialogMessageModel("Cannot add a Work Package to the briefcase while offline");
            return Promise.resolve(new JsonClientResponse(dialogMessage, 400));
        }
        const targets = ActionParametersState.targets(body)
        Log.info(`${thisMethod} -- is target an array? ${Array.isArray(targets)}`);
        if (targets && targets.length > 0) {
            for (const t of targets) {
                Log.info(`${thisMethod} -- adding selected work package id: ${t}`);
                this._delegateState.addSelectedWorkPackageId(targets[0]);
            }
        }
        const pathFields = DialogProxyTools.deconstructPostMenuActionPath(resourcePathElems);
        return SdaDialogDelegateTools.writeDelegateState(pathFields.tenantId, this._delegateState).then(voidValue => {
            return new JsonClientResponse(SdaDialogDelegateTools.
                constructAddToBriefcaseNullRedirection(pathFields.tenantId, pathFields.sessionId, pathFields.dialogId), 303);
        });
    }

    public removeWorkPackageFromBriefcase(baseUrl: string, resourcePathElems: string[], body?: StringDictionary): Promise<JsonClientResponse> {
        const thisMethod = 'SdaDialogDelegate::removeWorkPackageFromBriefcase';
        // REQUIRED: Before we can remove a Work Package from the briefcase, we must be online
        if (!this.online()) {
            const dialogMessage = DialogProxyTools.constructDialogMessageModel("Cannot remove a Work Package from the briefcase while offline");
            return Promise.resolve(new JsonClientResponse(dialogMessage, 400));
        }
        const targets = ActionParametersState.targets(body)
        Log.info(`${thisMethod} -- is target an array? ${Array.isArray(targets)}`);
        if (targets && targets.length > 0) {
            for (const t of targets) {
                Log.info(`${thisMethod} -- adding selected work package id: ${t}`);
                this._delegateState.removeSelectedWorkPackageId(targets[0]);
            }
        }
        const pathFields = DialogProxyTools.deconstructPostMenuActionPath(resourcePathElems);
        return SdaDialogDelegateTools.writeDelegateState(pathFields.tenantId, this._delegateState).then(voidValue => {
            return new JsonClientResponse(SdaDialogDelegateTools.
            constructRemoveFromBriefcaseNullRedirection(pathFields.tenantId, pathFields.sessionId, pathFields.dialogId), 303);
        });
    }

    public getBlob(baseUrl: string, resourcePath?: string): Promise<BlobClientResponse> | null {
        Log.info("SdaDialogDelegate::getBlob -- path: " + resourcePath);
        return null;
    }

    public getText(baseUrl: string, resourcePath?: string): Promise<TextClientResponse> | null {
        Log.info("SdaDialogDelegate::getText -- path: " + resourcePath);
        return null;
    }

    public openStream(baseUrl: string, resourcePath?: string): Promise<StreamProducer> | null {
        Log.info("SdaDialogDelegate::openStream -- path: " + resourcePath);
        return null;
    }

    public postMultipart<T>(baseUrl: string, resourcePath: string, formData: FormData): Promise<VoidClientResponse> | null {
        Log.info("SdaDialogDelegate::postMultipart -- path: " + resourcePath);
        return null;
    }

    public getJson(baseUrl: string, resourcePath: string, queryParams?: StringDictionary): Promise<JsonClientResponse> | null {
        Log.info("SdaDialogDelegate::getJson -- path: " + resourcePath);
        const resourcePathElems: string[] = resourcePath.split('/');
        if (DialogProxyTools.isGetDialog(resourcePathElems)) {
            const pathFields = DialogProxyTools.deconstructGetDialogPath(resourcePathElems);
            if (pathFields.dialogId === "offline_briefcase") {
                const response = SdaGetBriefcaseDialogJsonSample.response();
                response['tenantId'] = pathFields.tenantId;
                response['sessionId'] = pathFields.sessionId;
                for (const c of response['children']) {
                    c['tenantId'] = pathFields.tenantId;
                    c['sessionId'] = pathFields.sessionId;
                }
                return Promise.resolve(new JsonClientResponse(response, 200));
            }
        } else if (DialogProxyTools.isGetRecord(resourcePathElems)) {
            const pathFields = DialogProxyTools.deconstructGetRecordPath(resourcePathElems);
            if (pathFields.dialogId === "offline_briefcase_details") {
                const response = this._delegateState.briefcaseState().internalValue();
                return Promise.resolve(new JsonClientResponse(response, 200));
            }
        }
        return null;
    }

    public postJson(baseUrl: string, resourcePath: string, body?: StringDictionary): Promise<JsonClientResponse> | null {
        const thisMethod = 'SdaDialogDelegate::postJson';
        Log.info(`${thisMethod} -- path: ${resourcePath}`);
        Log.info(`${thisMethod} -- body: " + JSON.stringify(body)`);
        const resourcePathElems: string[] = resourcePath.split('/');
        if (SdaDialogDelegateTools.isAddToBriefcaseMenuActionRequest(resourcePathElems)) {
            return this.addWorkPackageToBriefcase(baseUrl, resourcePathElems, body);
        } else if (SdaDialogDelegateTools.isRemoveFromBriefcaseMenuActionRequest(resourcePathElems)) {
            return this.removeWorkPackageFromBriefcase(baseUrl, resourcePathElems, body);
        } else if (DialogProxyTools.isCreateSessionRequest(resourcePathElems)) {
            Log.info(`${thisMethod} -- CREATE SESSION`);
        } else if (SdaDialogDelegateTools.isBriefcaseWorkbenchActionRequest(resourcePathElems)) {
            const pathFields = DialogProxyTools.deconstructPostWorkbenchActionPath(resourcePathElems);
            const response = SdaPostBriefcaseWorkbenchActionJsonSample.response();
            response['tenantId'] = pathFields.tenantId;
            response['sessionId'] = pathFields.sessionId;
            return Promise.resolve(new JsonClientResponse(response, 303));
        } else if (DialogProxyTools.isPostRecords(resourcePathElems)) {
            const pathFields = DialogProxyTools.deconstructPostRecordsPath(resourcePathElems);
            if (pathFields.dialogId === "offline_briefcase_workpackages") {
                const response = RecordSetState.emptyRecordSet().internalValue();
                for (const id of this._delegateState.selectedWorkPackageIds()) {
                    Log.info(`${thisMethod} -- finding wp at id: ${id}`);
                    const wpr = this._delegateState.workPackagesState().findRecordAtId(id);
                    if (wpr) {
                        Log.info(`${thisMethod} -- found wp: ${wpr.copyAsJsonString()}`);
                        const swpr = SdaSelectedWorkPackageState.createFromWorkPackageState(wpr);
                        Log.info(`${thisMethod} -- created swpr: ${wpr.copyAsJsonString()}`);
                        (new RecordSetState(response)).addOrUpdateRecord(swpr);
                    } else {
                        Log.info(`${thisMethod} -- wp not found`);
                    }
                }
                return Promise.resolve(new JsonClientResponse(response, 200));
            }
            if (pathFields.dialogId === "offline_briefcase_comments") {
                const response = RecordSetState.emptyRecordSet().internalValue();
                return Promise.resolve(new JsonClientResponse(response, 200));
            }
        }
        return null;
    }

    public putJson(baseUrl: string, resourcePath: string, body?: StringDictionary): Promise<JsonClientResponse> | null {
        Log.info("SdaDialogDelegate::putJson -- path: " + resourcePath);
        Log.info("SdaDialogDelegate::putJson -- body: " + JSON.stringify(body));
        return null;
    }

    public deleteJson(baseUrl: string, resourcePath: string): Promise<JsonClientResponse> | null {
        Log.info("SdaDialogDelegate::deleteJson -- path: " + resourcePath);
        return null;
    }

    public handleDeleteJsonResponse(baseUrl: string, resourcePath: string, response: Promise<JsonClientResponse>): Promise<JsonClientResponse> | null {
        Log.info("SdaDialogDelegate::handleDeleteJsonResponse -- path: " + resourcePath);
        response.then(jcr => Log.info("SdaDialogDelegate::handleDeleteJsonResponse -- json response: " + JSON.stringify(jcr.value)));
        return response;
    }

    public handleGetBlobResponse(baseUrl: string, resourcePath: string, response: Promise<BlobClientResponse>): Promise<BlobClientResponse> | null {
        Log.info("SdaDialogDelegate::handleGetBlobResponse -- path: " + resourcePath);
        response.then(bcr => Log.info("SdaDialogDelegate::handleGetBlobResponse -- blob response: " + JSON.stringify(bcr.value)));
        return response;
    }

    public handleGetJsonResponse(baseUrl: string, resourcePath: string, queryParams: StringDictionary, response: Promise<JsonClientResponse>): Promise<JsonClientResponse> | null {
        Log.info("SdaDialogDelegate::handleGetJsonResponse -- path: " + resourcePath);
        response.then(jcr => Log.info("SdaDialogDelegate::handleGetJsonResponse -- json response: " + JSON.stringify(jcr.value)));
        return response.then(jcr => {
            if (jcr.statusCode === 200) {
                const jsonObject = jcr.value as StringDictionary;
                if (SdaDialogDelegateTools.isWorkPackagesRootDialog(jsonObject)) {
                    const resourcePathElems: string[] = resourcePath.split('/');
                    const pathFields = DialogProxyTools.deconstructGetDialogPath(resourcePathElems);
                    const workPackagesDialog = SdaDialogDelegateTools.patchWorkPackagesDialog(jsonObject);
                    return new JsonClientResponse(workPackagesDialog, 200);
                }
            }
            return jcr;
        });
    }

    public handleGetTextResponse(baseUrl: string, resourcePath: string, response: Promise<TextClientResponse>): Promise<TextClientResponse> | null {
        Log.info("SdaDialogDelegate::handleGetTextResponse -- path: " + resourcePath);
        response.then(tcr => Log.info("SdaDialogDelegate::handleGetTextResponse -- text response: " + JSON.stringify(tcr.value)));
        return response;
    }

    public handleOpenStreamResponse(baseUrl: string, resourcePath: string, response: Promise<StreamProducer>): Promise<StreamProducer> | null {
        Log.info("SdaDialogDelegate::handleOpenStreamResponse -- path: " + resourcePath);
        response.then(sp => Log.info("SdaDialogDelegate::handleOpenStreamResponse -- stream producer response: " + sp));
        return response;
    }

    public handlePostJsonResponse(baseUrl: string, resourcePath: string, body: StringDictionary, response: Promise<JsonClientResponse>): Promise<JsonClientResponse> | null {
        const thisMethod = 'SdaDialogDelegate::handlePostJsonResponse';
        Log.info(`${thisMethod} -- path: ${resourcePath}`);
        response.then(jcr => Log.info(`${thisMethod} -- json response: ${JSON.stringify(jcr.value)}`));
        return response.then(jcr => {
            if (jcr.statusCode === 200) {
                const resourcePathElems: string[] = resourcePath.split('/');
                const jsonObject = jcr.value as StringDictionary;
                if (DialogProxyTools.isSessionRootDialog(jsonObject)) {
                    return this.initializeAfterCreateSession(resourcePathElems, new SessionState(jsonObject)).then(voidValue => jcr);
                } else if (SdaDialogDelegateTools.isWorkPackagesQueryRecordSet(resourcePathElems, jsonObject)) {
                    const pathFields = DialogProxyTools.deconstructPostRecordsPath(resourcePathElems);
                    const workPackagesState = new SdaWorkPackagesState(jsonObject);
                    workPackagesState.insertBriefcaseFieldsUsingSelections(this._delegateState.selectedWorkPackageIds());
                    Log.info(`${thisMethod} -- PATCHED: ${workPackagesState.copyAsJsonString()}`);
                    this._delegateState.workPackagesState().addAllRecords(workPackagesState);
                    return SdaDialogDelegateTools.writeDelegateState(pathFields.tenantId, this._delegateState).then(voidValue => {
                        return new JsonClientResponse(workPackagesState.internalValue(), 200);
                    });
                }
            }
            return jcr;
        });
    }

    public handlePostMultipartResponse<T>(baseUrl: string, resourcePath: string, formData: FormData, response: Promise<VoidClientResponse>): Promise<VoidClientResponse> | null {
        Log.info("SdaDialogDelegate::handlePostMultipartResponse -- path: " + resourcePath);
        response.then(vcr => Log.info("SdaDialogDelegate::handlePostMultipartResponse -- void response: " + JSON.stringify(vcr.value)));
        return response;
    }

    public handlePutJsonResponse(baseUrl: string, resourcePath: string, body: StringDictionary, response: Promise<JsonClientResponse>): Promise<JsonClientResponse> | null {
        Log.info("SdaDialogDelegate::handlePutJsonResponse -- path: " + resourcePath);
        return response;
    }

    private initializeAfterCreateSession(resourcePathElems: string[], sessionState: SessionState): Promise<void> {
        const thisMethod = 'SdaDialogDelegate::initializeAfterCreateSession';
        const pathFields = DialogProxyTools.deconstructPostSessionsPath(resourcePathElems);
        return Promise.resolve().then(voidValue => {
            Log.info(`${thisMethod} -- showing storage keys`);
            return SdaDialogDelegateTools.showAllStorageKeys();
        }).then(voidValue => {
            return SdaDialogDelegateTools.readDelegateState(pathFields.tenantId, sessionState.userId());
        }).then(delegateState => {
            Log.info(`${thisMethod} -- delegate state before initializing: ${delegateState.copyAsJsonString()}`);
            Log.info(`${thisMethod} -- selected work packages count: ${delegateState.selectedWorkPackageIds().length}`);
            delegateState.setUserId(sessionState.userId());
            return SdaDialogDelegateTools.writeDelegateState(pathFields.tenantId, delegateState).then(voidValue => {
                this._delegateState = delegateState;
                return SdaDialogDelegateTools.showAllStorageKeys().then(voidValue2 => {
                    return SdaDialogDelegateTools.readDelegateState(pathFields.tenantId, sessionState.userId());
                }).then(freshDelegateStateValue => {
                    Log.info(`${thisMethod} -- delegate state after initializing: ${freshDelegateStateValue.copyAsJsonString()}`);
                    Log.info(`${thisMethod} -- done initializing`);
                });
            });
        });
    }

    private online(): boolean {
        return this._delegateState.briefcaseState().online();
    }

}
