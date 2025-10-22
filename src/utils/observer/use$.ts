import { setter } from "./binded";
import { Observer } from "./observer";

export const use$ = <T>(source: Observer<T>): [T, typeof source.set] =>
    [source.get(), setter(source)];