import { Observer } from "./observer";

export const binded = <T>(source: Observer<T>): Observer<T> => {
    if (!(source as any).isBinded) {
        (source as any).isBinded = true;
        source.get = source.get.bind(source);
        source.set = source.set.bind(source);
    }
    return source;
}

export const getter = <T>(source: Observer<T>) => binded(source).get;
export const setter = <T>(source: Observer<T>) => binded(source).set;