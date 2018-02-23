import {DialogApi} from "./DialogApi";
import {JsonClientResponse} from "../client/JsonClientResponse";
import {
    ActionParameters,
    Dialog,
    DialogMessage,
    EditorDialog,
    Login,
    Menu,
    ModelUtil,
    QueryParameters,
    Record,
    RecordSet,
    Redirection,
    Session,
    View,
    ViewDescriptor,
    ViewMode,
    Workbench,
    WorkbenchAction
} from "../models";
import {StringDictionary} from "../util/StringDictionary";
import {Client, ClientMode} from "../client/Client";

export class DialogService implements DialogApi {

    readonly baseUrl: string;

    constructor(readonly client: Client, serverUrl: string, readonly apiVersion) {
        this.baseUrl = `${serverUrl}/${apiVersion}`;
    }

    createSession(tenantId: string, login: Login): Promise<Session | Redirection> {

        return this.post(`tenants/${tenantId}/sessions`, login).then(
            jsonClientResponse => (new DialogServiceResponse<Session>(jsonClientResponse)).responseValueOrRedirect()
        );

    }

    getSession(tenantId: string, sessionId: string): Promise<Session> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}`).then(
            jsonClientResponse => (new DialogServiceResponse<Session>(jsonClientResponse)).responseValue()
        );

    }

    deleteSession(tenantId: string, sessionId: string): Promise<{ sessionId: string }> {

        return this.d3lete(`tenants/${tenantId}/sessions/${sessionId}`).then(
            jsonClientResponse => (new DialogServiceResponse<{ sessionId: string }>(jsonClientResponse)).responseValue()
        );

    }

    getWorkbenches(tenantId: string, sessionId: string): Promise<Array<Workbench>> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/workbenches`).then(
            jsonClientResponse => (new DialogServiceResponse<Array<Workbench>>(jsonClientResponse)).responseValue()
        );

    }

    getWorkbench(tenantId: string, sessionId: string, workbenchId: string): Promise<Workbench> {

        return this.get(`tenants/{$tenantId}/sessions/{$sessionId}/workbenches/{$workbenchId}`).then(
            jsonClientResponse => (new DialogServiceResponse<Workbench>(jsonClientResponse)).responseValue()
        );

    }

    getRedirection(tenantId: string, sessionId: string, redirectionId: string): Promise<Redirection> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/redirections/${redirectionId}`).then(
            jsonClientResponse => (new DialogServiceResponse<Redirection>(jsonClientResponse)).responseValue()
        );

    }

    getDialog(tenantId: string, sessionId: string, dialogId: string): Promise<Dialog> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}`).then(
            jsonClientResponse => (new DialogServiceResponse<Dialog>(jsonClientResponse)).responseValue()
        );

    }

    deleteDialog(tenantId: string, sessionId: string, dialogId: string): Promise<{ dialogId: string }> {

        return this.d3lete(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}`).then(
            jsonClientResponse => (new DialogServiceResponse<{ dialogId: string }>(jsonClientResponse)).responseValue()
        );

    }

    getActions(tenantId: string, sessionId: string, dialogId: string): Promise<Array<Menu>> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/actions`).then(
            jsonClientResponse => (new DialogServiceResponse<Array<Menu>>(jsonClientResponse)).responseValue()
        );

    }

    performAction(tenantId: string, sessionId: string, dialogId: string, actionId: string,
                  actionParameters: ActionParameters): Promise<{ actionId: string } | Redirection> {

        const encodedActionId = encodeURIComponent(actionId);
        return this.post(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/actions/${encodedActionId}`, actionParameters).then(
            jsonClientResponse => (new DialogServiceResponse<{ actionId: string }>(jsonClientResponse)).responseValueOrRedirect()
        );

    }

    getWorkbenchActions(tenantId: string, sessionId: string, workbenchId: string): Promise<Array<WorkbenchAction>> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/workbenches/${workbenchId}/actions`).then(
            jsonClientResponse => (new DialogServiceResponse<Array<WorkbenchAction>>(jsonClientResponse)).responseValue()
        );

    }

    performWorkbenchAction(tenantId: string, sessionId: string, workbenchId: string, actionId: string): Promise<{ actionId: string } | Redirection> {

        return this.post(`tenants/${tenantId}/sessions/${sessionId}/workbenches/${workbenchId}/actions/${actionId}`, {}).then(
            jsonClientResponse => (new DialogServiceResponse<{ actionId: string }>(jsonClientResponse)).responseValueOrRedirect()
        );

    }

    getRecord(tenantId: string, sessionId: string, dialogId: string): Promise<Record> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/record`).then(
            jsonClientResponse => (new DialogServiceResponse<Record>(jsonClientResponse)).responseValue()
        );

    }

    putRecord(tenantId: string, sessionId: string, dialogId: string, record: Record): Promise<Record | Redirection> {

        return this.put(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/record`, record).then(
            jsonClientResponse => (new DialogServiceResponse<Record | Redirection>(jsonClientResponse)).responseValueOrRedirect()
        );
    }

    getRecords(tenantId: string, sessionId: string, dialogId: string, queryParams: QueryParameters): Promise<RecordSet> {

        return this.post(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/records`, queryParams).then(
            jsonClientResponse => (new DialogServiceResponse<RecordSet>(jsonClientResponse)).responseValue()
        );
    }

    getAvailableValues(tenantId: string, sessionId: string, dialogId: string, propertyName: string): Promise<Array<any>> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/record/${propertyName}/availableValues`).then(
            jsonClientResponse => (new DialogServiceResponse<Array<any>>(jsonClientResponse)).responseValue()
        );
    }

    getMode(tenantId: string, sessionId: string, dialogId: string): Promise<ViewMode> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/viewMode`).then(
            jsonClientResponse => (new DialogServiceResponse<ViewMode>(jsonClientResponse)).responseValue()
        );
    }

    changeMode(tenantId: string, sessionId: string, dialogId: string, mode: ViewMode): Promise<EditorDialog> {

        return this.put(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/viewMode/${mode}`).then(
            jsonClientResponse => (new DialogServiceResponse<EditorDialog>(jsonClientResponse)).responseValue()
        );

    }

    getView(tenantId: string, sessionId: string, dialogId: string): Promise<View> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/view`).then(
            jsonClientResponse => (new DialogServiceResponse<View>(jsonClientResponse)).responseValue()
        );

    }

    changeView(tenantId: string, sessionId: string, dialogId: string, viewId: string): Promise<Dialog> {

        return this.put(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/selectedView/{viewId}`, {}).then(
            jsonClientResponse => (new DialogServiceResponse<Dialog>(jsonClientResponse)).responseValue()
        );

    }

    getViews(tenantId: string, sessionId: string, dialogId: string): Promise<Array<ViewDescriptor>> {

        return this.get(`tenants/${tenantId}/sessions/${sessionId}/dialogs/${dialogId}/availableViews`).then(
            jsonClientResponse => (new DialogServiceResponse<Array<View>>(jsonClientResponse)).responseValue()
        );

    }

    get lastServiceActivity(): Date {
        return this.client.lastActivity;
    }

    setClientMode(clientMode: ClientMode): void {
        this.client.setClientMode(clientMode);
    }

    /* Private methods */

    private get(path: string, queryParams?: StringDictionary): Promise<JsonClientResponse> {
        return this.client.getJson(`${this.baseUrl}`, path, queryParams);
    }

    private post<T>(path: string, body?: T): Promise<JsonClientResponse> {
        return this.client.postJson(`${this.baseUrl}`, path, body);
    }

    private d3lete(path: string): Promise<JsonClientResponse> {
        return this.client.deleteJson(`${this.baseUrl}`, path);
    }

    private put<T>(path: string, body?: T): Promise<JsonClientResponse> {
        return this.client.putJson(`${this.baseUrl}`, path, body);
    }

}

interface DialogApiResponse<T> {

    responseValue(): Promise<T>;

    responseValueOrRedirect(): Promise<T | Redirection>;

    assertNoError(): Promise<void>;

}

class DialogServiceResponse<T> implements DialogApiResponse<T> {

    constructor(private readonly clientResponse: JsonClientResponse) {
    }

    responseValue(): Promise<T> {
        return new Promise((resolve, reject) => {
            if (this.hasError) {
                reject(<DialogMessage>this.clientResponse.value);
            } else {
                this.fullfillJsonToModel<T>(this.clientResponse, resolve, reject);
            }
        });
    }

    responseValueOrRedirect(): Promise<T | Redirection> {
        return new Promise((resolve, reject) => {
            if (this.hasError) {
                reject(<DialogMessage>this.clientResponse.value);
            } else if (this.hasValue) {
                this.fullfillJsonToModel<T>(this.clientResponse, resolve, reject);
            } else {
                this.fullfillJsonToModel<Redirection>(this.clientResponse, resolve, reject);
            }
        });
    }

    assertNoError(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.hasError) {
                reject(<DialogMessage>this.clientResponse.value);
            } else {
                resolve(undefined);
            }
        });
    }

    get hasValue(): boolean {
        return this.clientResponse.statusCode >= 200 && this.clientResponse.statusCode < 300;
    }

    get hasRedirection(): boolean {
        return this.clientResponse.statusCode >= 300 && this.clientResponse.statusCode < 400;
    }

    get hasError(): boolean {
        return this.clientResponse.statusCode >= 400;
    }

    private fullfillJsonToModel<T>(clientResponse: JsonClientResponse, resolve, reject): void {

        ModelUtil.jsonToModel<T>(this.clientResponse.value).then(resolve).catch(reject);
    }

}