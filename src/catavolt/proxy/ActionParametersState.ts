/**
 *
 */
export class ActionParametersState {

    private _value: any;

    constructor(value: string | object) {
        if (typeof value === 'string') {
            this._value = JSON.parse(value as string);
        } else {
            this._value = value;
        }
    }

    // --- State Management Helpers --- //

    public static targets(actionParameters: object): string[] {
        return (new ActionParametersState(actionParameters)).targets();
    }

    // --- State Import/Export --- //

    public copyAsJsonObject(): object {
        return JSON.parse(this.copyAsJsonString());
    }

    public copyAsJsonString(): string {
        return JSON.stringify(this.internalValue());
    }

    public internalValue() {
        return this._value;
    }

    // --- State Management --- //

    public targets(): string[] {
        return this._value.targets;
    }

}