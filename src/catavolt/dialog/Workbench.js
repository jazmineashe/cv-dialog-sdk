/**
 * Created by rburson on 3/17/15.
 */
var ArrayUtil_1 = require("../util/ArrayUtil");
var Workbench = (function () {
    function Workbench(_id, _name, _alias, _actions) {
        this._id = _id;
        this._name = _name;
        this._alias = _alias;
        this._actions = _actions;
    }
    Object.defineProperty(Workbench.prototype, "alias", {
        get: function () {
            return this._alias;
        },
        enumerable: true,
        configurable: true
    });
    Workbench.prototype.getLaunchActionById = function (launchActionId) {
        var result = null;
        this.workbenchLaunchActions.some(function (launchAction) {
            if (launchAction.id = launchActionId) {
                result = launchAction;
                return true;
            }
        });
        return result;
    };
    Object.defineProperty(Workbench.prototype, "name", {
        get: function () {
            return this._name;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Workbench.prototype, "workbenchId", {
        get: function () {
            return this._id;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Workbench.prototype, "workbenchLaunchActions", {
        get: function () {
            return ArrayUtil_1.ArrayUtil.copy(this._actions);
        },
        enumerable: true,
        configurable: true
    });
    return Workbench;
})();
exports.Workbench = Workbench;