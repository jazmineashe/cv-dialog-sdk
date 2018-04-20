import {SdaBriefcaseState} from "./SdaBriefcaseState";
import {SdaSelectedWorkPackagesState} from "./SdaSelectedWorkPackagesState";

/**
 *
 */
export class SdaDialogDelegateState {

    private _value: any;

    constructor(state: string | object) {
        if (typeof state === 'string') {
            this._value = JSON.parse(state as string);
        } else {
            this._value = state;
        }
    }

    // --- State Management Helpers --- //

    // --- State Import/Export --- //

    public internalValue() {
        return this._value;
    }

    public copyAsJsonObject(): object {
        return JSON.parse(this.copyAsJsonString());
    }

    public copyAsJsonString(): string {
        return JSON.stringify(this.internalValue());
    }

    // --- State Management --- //

    public briefcaseState(): SdaBriefcaseState {
        return new SdaBriefcaseState(this.internalValue().briefcase);
    }

    public selectedWorkPackageIds(): string[] {
        return this.internalValue().selectedWorkPackageIds;
    }

    public addSelectedWorkPackageId(id: string) {
        const index = this.internalValue().selectedWorkPackageIds.indexOf(id);
        if (index === -1) {
            this.internalValue().selectedWorkPackageIds.push(id);
        }
    }

    public removeSelectedWorkPackageId(id: string) {
        const index = this.internalValue().selectedWorkPackageIds.indexOf(id);
        if (index > -1) {
            this.internalValue().selectedWorkPackageIds.splice(index, 1);
        }
    }

    public setBriefcaseState(briefcase: SdaBriefcaseState) {
        this.internalValue().briefcase = briefcase.internalValue();
    }

    public userId(): string {
        return this.internalValue().userId;
    }

    public setUserId(userId: string) {
        this.internalValue().userId = userId;
    }

}
