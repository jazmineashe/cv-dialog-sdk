/**
 * Created by rburson on 3/6/15.
 */
var ArrayUtil = (function () {
    function ArrayUtil() {
    }
    ArrayUtil.copy = function (source) {
        return source.map(function (e) {
            return e;
        });
    };
    ArrayUtil.find = function (source, f) {
        var value = null;
        source.some(function (v) {
            if (f(v)) {
                value = v;
                return true;
            }
            return false;
        });
        return value;
    };
    return ArrayUtil;
})();
exports.ArrayUtil = ArrayUtil;
/**
 * *****************************************************
 */
/*
 This implementation supports our ECMA 5.1 browser set, including IE9
 If we no longer need to support IE9, a TypedArray implementaion would be more efficient...
 */
var Base64 = (function () {
    function Base64() {
    }
    Base64.encode = function (input) {
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;
        input = Base64._utf8_encode(input);
        while (i < input.length) {
            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);
            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;
            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            }
            else if (isNaN(chr3)) {
                enc4 = 64;
            }
            output = output +
                Base64._keyStr.charAt(enc1) + Base64._keyStr.charAt(enc2) +
                Base64._keyStr.charAt(enc3) + Base64._keyStr.charAt(enc4);
        }
        return output;
    };
    Base64.decode = function (input) {
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
        while (i < input.length) {
            enc1 = Base64._keyStr.indexOf(input.charAt(i++));
            enc2 = Base64._keyStr.indexOf(input.charAt(i++));
            enc3 = Base64._keyStr.indexOf(input.charAt(i++));
            enc4 = Base64._keyStr.indexOf(input.charAt(i++));
            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;
            output = output + String.fromCharCode(chr1);
            if (enc3 != 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
                output = output + String.fromCharCode(chr3);
            }
        }
        output = Base64._utf8_decode(output);
        return output;
    };
    Base64._utf8_encode = function (s) {
        s = s.replace(/\r\n/g, "\n");
        var utftext = "";
        for (var n = 0; n < s.length; n++) {
            var c = s.charCodeAt(n);
            if (c < 128) {
                utftext += String.fromCharCode(c);
            }
            else if ((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            }
            else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
        }
        return utftext;
    };
    Base64._utf8_decode = function (utftext) {
        var s = "";
        var i = 0;
        var c = 0, c1 = 0, c2 = 0, c3 = 0;
        while (i < utftext.length) {
            c = utftext.charCodeAt(i);
            if (c < 128) {
                s += String.fromCharCode(c);
                i++;
            }
            else if ((c > 191) && (c < 224)) {
                c2 = utftext.charCodeAt(i + 1);
                s += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                i += 2;
            }
            else {
                c2 = utftext.charCodeAt(i + 1);
                c3 = utftext.charCodeAt(i + 2);
                s += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }
        }
        return s;
    };
    Base64._keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    return Base64;
})();
exports.Base64 = Base64;
/**
 * *****************************************************
 */
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(exports.LogLevel || (exports.LogLevel = {}));
var LogLevel = exports.LogLevel;
var Log = (function () {
    function Log() {
    }
    Log.logLevel = function (level) {
        if (level >= LogLevel.DEBUG) {
            Log.debug = function (message, method, clz) {
                Log.log(function (o) {
                    console.info(o);
                }, 'DEBUG: ' + message, method, clz);
            };
        }
        else {
            Log.debug = function (message, method, clz) {
            };
        }
        if (level >= LogLevel.INFO) {
            Log.info = function (message, method, clz) {
                Log.log(function (o) {
                    console.info(o);
                }, 'INFO: ' + message, method, clz);
            };
        }
        else {
            Log.info = function (message, method, clz) {
            };
        }
        if (level >= LogLevel.WARN) {
            Log.error = function (message, clz, method) {
                Log.log(function (o) {
                    console.error(o);
                }, 'ERROR: ' + message, method, clz);
            };
        }
        else {
            Log.error = function (message, clz, method) {
            };
        }
        if (level >= LogLevel.ERROR) {
            Log.warn = function (message, clz, method) {
                Log.log(function (o) {
                    console.info(o);
                }, 'WARN: ' + message, method, clz);
            };
        }
        else {
            Log.warn = function (message, clz, method) {
            };
        }
    };
    Log.log = function (logger, message, method, clz) {
        var m = typeof message !== 'string' ? Log.formatRecString(message) : message;
        if (clz || method) {
            logger(clz + "::" + method + " : " + m);
        }
        else {
            logger(m);
        }
    };
    Log.formatRecString = function (o) {
        return ObjUtil.formatRecAttr(o);
    };
    //set default log level here
    Log.init = Log.logLevel(LogLevel.INFO);
    return Log;
})();
exports.Log = Log;
/**
 * *****************************************************
 */
var ObjUtil = (function () {
    function ObjUtil() {
    }
    ObjUtil.addAllProps = function (sourceObj, targetObj) {
        if (null == sourceObj || "object" != typeof sourceObj)
            return targetObj;
        if (null == targetObj || "object" != typeof targetObj)
            return targetObj;
        for (var attr in sourceObj) {
            targetObj[attr] = sourceObj[attr];
        }
        return targetObj;
    };
    ObjUtil.cloneOwnProps = function (sourceObj) {
        if (null == sourceObj || "object" != typeof sourceObj)
            return sourceObj;
        var copy = sourceObj.constructor();
        for (var attr in sourceObj) {
            if (sourceObj.hasOwnProperty(attr)) {
                copy[attr] = ObjUtil.cloneOwnProps(sourceObj[attr]);
            }
        }
        return copy;
    };
    ObjUtil.copyNonNullFieldsOnly = function (obj, newObj, filterFn) {
        for (var prop in obj) {
            if (!filterFn || filterFn(prop)) {
                var type = typeof obj[prop];
                if (type !== 'function') {
                    var val = obj[prop];
                    if (val) {
                        newObj[prop] = val;
                    }
                }
            }
        }
        return newObj;
    };
    ObjUtil.formatRecAttr = function (o) {
        //@TODO - add a filter here to build a cache and detect (and skip) circular references
        return JSON.stringify(o);
    };
    ObjUtil.newInstance = function (type) {
        return new type;
    };
    return ObjUtil;
})();
exports.ObjUtil = ObjUtil;
/**
 * *****************************************************
 */
var StringUtil = (function () {
    function StringUtil() {
    }
    StringUtil.splitSimpleKeyValuePair = function (pairString) {
        var index = pairString.indexOf(':');
        var code = '';
        var desc = '';
        if (index > -1) {
            code = pairString.substr(0, index);
            desc = pairString.length > index ? pairString.substr(index + 1) : '';
        }
        return [code, desc];
    };
    return StringUtil;
})();
exports.StringUtil = StringUtil;
//# sourceMappingURL=util.js.map