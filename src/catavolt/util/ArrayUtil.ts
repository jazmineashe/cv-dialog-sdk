/**
 * Created by rburson on 8/28/17.
 */

export class ArrayUtil {

    static copy<T>(source: Array<T>): Array<T> {
        return source.map((e: T) => {
            return e
        });
    }

    static find<T>(source: Array<T>, f: (T) => boolean): T {
        var value: T = null;
        source.some((v: T) => {
            if (f(v)) {
                value = v;
                return true;
            }
            return false;
        });
        return value;
    }
}