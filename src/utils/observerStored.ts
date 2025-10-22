import { Check } from "./check";
import { Observer, observer } from "./observer";
import { getStored, setStored } from "./stored";
import { toError } from "./to";

export const stored = <T>(observer: Observer<T>, check?: Check) => {
    if (!observer.key) throw toError('no stored key');
    const last = getStored(observer.key, observer.get(), check);
    observer.set(last);
    observer.on(value => setStored(observer.key, value));
    return observer;
}

interface NewObserverStored {
    <T>(init: undefined, key: string, check?: Check): Observer<T|undefined>;
    <T>(init: T, key: string, check?: Check): Observer<T>;
}
export const observerStored = (<T>(init: T, key: string, check?: Check) => (
    stored(observer(init, key), check)
)) as NewObserverStored;
