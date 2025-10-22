import { toMe } from "../to";
import { mapped } from "./mapped";
import { Observer } from "./observer";
import { throttle } from "./throttle";

export const throttled = <T>(source: Observer<T>, ms: number): Observer<T> => {
    const target = mapped(source, toMe, toMe);
    const original = target.sync.bind(mapped);
    const fun = throttle(() => original(), ms);
    target.sync = () => fun(undefined);
    return target;
}