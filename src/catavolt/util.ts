/**
 * Created by rburson on 3/6/15.
 */

export class ArrayUtil {

    static copy<T>(source:Array<T>):Array<T> {
        return source.map((e:T)=> {
            return e
        });
    }

    static find<T>(source:Array<T>, f:(T)=>boolean):T {
        var value:T = null;
        source.some((v:T)=> {
            if (f(v)) {
                value = v;
                return true;
            }
            return false;
        });
        return value;
    }
}
/**
 * *****************************************************
 */

/*
 This implementation supports our ECMA 5.1 browser set, including IE9
 If we no longer need to support IE9, a TypedArray implementaion would be more efficient...
 */
export class Base64 {

    private static _keyStr:string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

    static encode(input) {
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
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }
            output = output +
                Base64._keyStr.charAt(enc1) + Base64._keyStr.charAt(enc2) +
                Base64._keyStr.charAt(enc3) + Base64._keyStr.charAt(enc4);

        }
        return output;
    }

    static decode(input) {
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
    }

    private static _utf8_encode(s) {
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
    }

    static _utf8_decode(utftext) {
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
    }

}
/**
 * *****************************************************
 */



export enum LogLevel { ERROR, WARN, INFO, DEBUG }

export class Log {

    public static debug:(message, method?:string, clz?:string)=>void;
    public static error:(message, method?:string, clz?:string)=>void;
    public static info:(message, method?:string, clz?:string)=>void;
    public static warn:(message, method?:string, clz?:string)=>void;

    //set default log level here
    static init = Log.logLevel(LogLevel.INFO);

    static logLevel(level:LogLevel) {

        if (level >= LogLevel.DEBUG) {
            Log.debug = (message, method?:string, clz?:string)=> {
                Log.log((o)=> {
                    console.info(o);
                }, 'DEBUG: ' + message, method, clz);
            };
        } else {
            Log.debug = (message, method?:string, clz?:string)=> {
            };
        }
        if (level >= LogLevel.INFO) {
            Log.info = (message, method?:string, clz?:string)=> {
                Log.log((o)=> {
                    console.info(o);
                }, 'INFO: ' + message, method, clz);
            };
        } else {
            Log.info = (message, method?:string, clz?:string)=> {
            };
        }
        if (level >= LogLevel.WARN) {
            Log.error = (message, clz?:string, method?:string)=> {
                Log.log((o)=> {
                    console.error(o);
                }, 'ERROR: ' + message, method, clz);
            };
        } else {
            Log.error = (message, clz?:string, method?:string)=> {
            };
        }
        if (level >= LogLevel.ERROR) {
            Log.warn = (message, clz?:string, method?:string)=> {
                Log.log((o)=> {
                    console.info(o);
                }, 'WARN: ' + message, method, clz);
            };
        } else {
            Log.warn = (message, clz?:string, method?:string)=> {
            };
        }
    }

    private static log(logger, message, method?:string, clz?:string) {

        var m:string = typeof message !== 'string' ? Log.formatRecString(message) : message;

        if (clz || method) {
            logger(clz + "::" + method + " : " + m);
        } else {
            logger(m);
        }
    }

    static formatRecString(o):string {
        return ObjUtil.formatRecAttr(o);
    }

}
/**
 * *****************************************************
 */

export class ObjUtil {

    static addAllProps(sourceObj, targetObj):any {
        if (null == sourceObj || "object" != typeof sourceObj) return targetObj;
        if (null == targetObj || "object" != typeof targetObj) return targetObj;
        for (var attr in sourceObj) {
            targetObj[attr] = sourceObj[attr];
        }
        return targetObj;
    }

    static cloneOwnProps(sourceObj):any {
        if (null == sourceObj || "object" != typeof sourceObj) return sourceObj;
        var copy = sourceObj.constructor();
        for (var attr in sourceObj) {
            if (sourceObj.hasOwnProperty(attr)) {
                copy[attr] = ObjUtil.cloneOwnProps(sourceObj[attr]);
            }
        }
        return copy;
    }

    static copyNonNullFieldsOnly(obj, newObj, filterFn?:(prop)=>boolean) {
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
    }

    static formatRecAttr(o):string {
        //@TODO - add a filter here to build a cache and detect (and skip) circular references
        return JSON.stringify(o);
    }

    static newInstance(type) {
        return new type;
    }

}

/**
 * *****************************************************
 */
export class StringUtil {

    static splitSimpleKeyValuePair(pairString:string):Array<string> {
        var pair:Array<string> = pairString.split(':');
        var code = pair[0];
        var desc = pair.length > 1 ? pair[1] : '';
        return [code, desc];
    }
}
/**
 * *****************************************************
 */

export interface StringDictionary{ [index: string]: any; }
export interface Dictionary<T>{ [index: string]: T; }
/**
 * *****************************************************
 */

/* @TODO - extend this with UserMessage? */
export interface UserException {

    iconName:string;
    message:string;
    name:string;
    stackTrace:string;
    title:string;
}