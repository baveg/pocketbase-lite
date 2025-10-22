import { Check } from "../check";
import { Observer, observer } from "./observer";
import { getStored, setStored } from "../stored";

interface NewObserverStored {
    <T>(init: undefined, key: string, check?: Check): Observer<T|undefined>;
    <T>(init: T, key: string, check?: Check): Observer<T>;
}
export const stored = (<T>(init: T, key: string, check?: Check) => {
    const target = observer(init, key);
    const last = getStored(key, target.get(), check);
    target.set(last);
    target.on(value => setStored(target.key, value));
    return target;
}) as NewObserverStored;
