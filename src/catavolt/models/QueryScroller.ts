import { ArrayUtil } from '../util/ArrayUtil';
import { NullRecord } from './NullRecord';
import { QueryDialog } from './QueryDialog';
import { Record } from './Record';
import { RecordSet } from './RecordSet';
import { QueryDirectionEnum } from './types';

/**
 * *********************************
 */

class HasMoreQueryMarker extends NullRecord {
    public static singleton = new HasMoreQueryMarker();
}

class IsEmptyQueryMarker extends NullRecord {
    public static singleton = new IsEmptyQueryMarker();
}

export enum QueryMarkerOption {
    None,
    IsEmpty,
    HasMore
}

export class QueryScroller {
    private _buffer: Record[];
    private _hasMoreBackward: boolean;
    private _hasMoreForward: boolean;
    private _nextPagePromise: Promise<RecordSet>;
    private _prevPagePromise: Promise<RecordSet>;
    private _refreshPromise: Promise<Record[]>;
    private _firstResultRecordId: string;

    constructor(
        private _dialog: QueryDialog,
        private _defaultPageSize: number,
        private _firstRecordId: string,
        private _markerOptions: QueryMarkerOption[] = []
    ) {
        this.clear();
    }

    get buffer(): Record[] {
        return this._buffer;
    }

    get bufferWithMarkers(): Record[] {
        const result = ArrayUtil.copy(this._buffer);
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
                    result.unshift(HasMoreQueryMarker.singleton);
                }
                if (this._hasMoreForward) {
                    result.push(HasMoreQueryMarker.singleton);
                }
            }
        }
        return result;
    }

    get dialog(): QueryDialog {
        return this._dialog;
    }

    get firstRecordId(): string {
        return this._firstRecordId;
    }

    get hasMoreBackward(): boolean {
        return this._hasMoreBackward;
    }

    get hasMoreForward(): boolean {
        return this._hasMoreForward;
    }

    get isComplete(): boolean {
        return !this._hasMoreBackward && !this._hasMoreForward;
    }

    get isCompleteAndEmpty(): boolean {
        return this.isComplete && this._buffer.length === 0;
    }

    get isEmpty(): boolean {
        return this._buffer.length === 0;
    }

    public pageBackward(pageSize: number = this.pageSize): Promise<Record[]> {
        if (!this._hasMoreBackward) {
            return Promise.resolve([]);
        }

        if (this._prevPagePromise) {
            this._prevPagePromise = this._prevPagePromise.then((recordSet: RecordSet) => {
                const fromRecordId = this._buffer.length === 0 ? null : this._buffer[0].id;
                return this._dialog.query(pageSize, QueryDirectionEnum.BACKWARD, fromRecordId);
            });
        } else {
            const fromRecordId = this._buffer.length === 0 ? null : this._buffer[0].id;
            this._prevPagePromise = this._dialog.query(pageSize, QueryDirectionEnum.BACKWARD, fromRecordId);
        }

        return this._prevPagePromise.then((queryResult: RecordSet) => {
            this._hasMoreBackward = queryResult.hasMore;
            if (queryResult.records.length > 0) {
                const newBuffer: Record[] = [];
                for (let i = queryResult.records.length - 1; i > -1; i--) {
                    newBuffer.push(queryResult.records[i]);
                }
                this._buffer.forEach((record: Record) => {
                    newBuffer.push(record);
                });
                this._buffer = newBuffer;
            }
            return queryResult.records;
        });
    }

    public pageForward(pageSize: number = this.pageSize): Promise<Record[]> {
        if (!this._hasMoreForward) {
            return Promise.resolve([]);
        }

        if (this._nextPagePromise) {
            this._nextPagePromise = this._nextPagePromise.then((recordSet: RecordSet) => {
                const fromRecordId = this._buffer.length === 0 ? null : this._buffer[this._buffer.length - 1].id;
                return this._dialog.query(pageSize, QueryDirectionEnum.FORWARD, fromRecordId);
            });
        } else {
            const fromRecordId = this._buffer.length === 0 ? null : this._buffer[this._buffer.length - 1].id;
            this._nextPagePromise = this._dialog.query(pageSize, QueryDirectionEnum.FORWARD, fromRecordId);
        }

        return this._nextPagePromise.then((queryResult: RecordSet) => {
            this._hasMoreForward = queryResult.hasMore;
            if (queryResult.records.length > 0) {
                const newBuffer: Record[] = [];
                this._buffer.forEach((record: Record) => {
                    newBuffer.push(record);
                });
                queryResult.records.forEach((record: Record) => {
                    newBuffer.push(record);
                });
                this._buffer = newBuffer;
            }
            return queryResult.records;
        });
    }

    get pageSize(): number {
        return this._defaultPageSize;
    }

    public refresh(numRows: number = this.pageSize): Promise<Record[]> {
        if(this._refreshPromise) {
           this._refreshPromise = this._refreshPromise.then((records: Record[])=>{
               this.clear();
               return this.pageForward(numRows);
           });
        } else {
            this.clear();
            this._refreshPromise = this.pageForward(numRows);
        }
        return this._refreshPromise.then((records: Record[]) => {
            if (records.length > 0) {
                this._firstResultRecordId = records[0].id;
            }
            return records;
        });
    }

    public trimFirst(n: number) {
        const newBuffer = [];
        for (let i = n; i < this._buffer.length; i++) {
            newBuffer.push(this._buffer[i]);
        }
        this._buffer = newBuffer;
        this._hasMoreBackward = true;
    }

    public trimLast(n: number) {
        const newBuffer = [];
        for (let i = 0; i < this._buffer.length - n; i++) {
            newBuffer.push(this._buffer[i]);
        }
        this._buffer = newBuffer;
        this._hasMoreForward = true;
    }

    private clear() {
        this._hasMoreBackward = !!this._firstRecordId;
        this._hasMoreForward = true;
        this._buffer = [];
        this._firstResultRecordId = null;
    }
}
