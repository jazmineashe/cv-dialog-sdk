/**
 * Created by rburson on 4/27/15.
 */

import {PaneContext} from "./PaneContext";
import {Future} from "../fp/Future";
import {QueryResult} from "./QueryResult";
import {QueryScroller} from "./QueryScroller";
import {EntityRec} from "./EntityRec";
import {StringDictionary} from "../util/Types";
import {EntityRecDef} from "./EntityRecDef";
import {ColumnDef} from "./ColumnDef";
import {MenuDef} from "./MenuDef";
import {NavRequest} from "./NavRequest";
import {DialogService} from "./DialogService";
import {QueryMarkerOption} from "./QueryScroller";
import {XQueryResult} from "./XQueryResult";
import {ContextAction} from "./ContextAction";
import {Redirection} from "./Redirection";
import {NavRequestUtil} from "./NavRequest";

enum QueryState { ACTIVE, DESTROYED }

export enum QueryDirection { FORWARD, BACKWARD }

export class QueryContext extends PaneContext {

    private _lastQueryFr:Future<QueryResult>;
    private _queryState:QueryState;
    private _scroller:QueryScroller;

    constructor(paneRef:number, private _offlineRecs:Array<EntityRec> = [], private _settings:StringDictionary = {}) {
        super(paneRef);
    }

    get entityRecDef():EntityRecDef {
        return this.paneDef.entityRecDef;
    }

    isBinary(columnDef:ColumnDef):boolean {
        var propDef = this.propDefAtName(columnDef.name);
        return propDef && (propDef.isBinaryType || (propDef.isURLType && columnDef.isInlineMediaStyle));
    }

    get isDestroyed():boolean {
        return this._queryState === QueryState.DESTROYED;
    }

    get lastQueryFr():Future<QueryResult> {
        return this._lastQueryFr;
    }

    get offlineRecs():Array<EntityRec> {
        return this._offlineRecs;
    }

    set offlineRecs(offlineRecs:Array<EntityRec>) {
        this._offlineRecs = offlineRecs;
    }

    get paneMode():string {
        return this._settings['paneMode'];
    }

    performMenuAction(menuDef:MenuDef, targets:Array<string>):Future<NavRequest> {
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
            return navRequest;
        });
    }

    query(maxRows:number, direction:QueryDirection, fromObjectId:string):Future<QueryResult> {
        return DialogService.queryQueryModel(this.paneDef.dialogHandle, direction, maxRows,
            fromObjectId, this.sessionContext).bind((value:XQueryResult)=> {
            var result = new QueryResult(value.entityRecs, value.hasMore);
            if (this.lastRefreshTime === new Date(0)) {
                this.lastRefreshTime = new Date();
            }
            return Future.createSuccessfulFuture('QueryContext::query', result);
        });
    }

    refresh():Future<Array<EntityRec>> {
        return this._scroller.refresh();
    }

    get scroller():QueryScroller {
        if (!this._scroller) {
            this._scroller = this.newScroller();
        }
        return this._scroller;
    }

    setScroller(pageSize:number, firstObjectId:string, markerOptions:Array<QueryMarkerOption>) {
        this._scroller = new QueryScroller(this, pageSize, firstObjectId, markerOptions);
        return this._scroller;
    }

    //module level methods

    newScroller():QueryScroller {
        return this.setScroller(50, null, [QueryMarkerOption.None]);
    }

    settings():StringDictionary {
        return this._settings;
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

}
