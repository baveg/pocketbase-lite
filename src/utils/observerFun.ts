import { isFun } from "./check";
import { Logger, logger } from "./logger";
import { removeItem } from "./removeItem";

export type Listener<T> = (next: T) => void;
export type Unsubscribe<T> = () => void;
export type Subscribe<T> = (listener: Listener<T>, isRepeat?: boolean) => Unsubscribe<T>;
export type Getter<T> = () => T;
export type Next<T> = T|((prev: T) => T);
export type Setter<T> = (next: Next<T>, force?: boolean) => void;

export interface Observer<T> {
    readonly key: string;
    readonly listeners: Listener<T>[];
    readonly clear: () => void;
    readonly get: Getter<T>;
    readonly next: Setter<T>;
    readonly on: Subscribe<T>;
};

export interface ObserverOptions<T> {
    readonly key?: string;
    readonly name?: string;
    readonly isEqual?: (prev: T, next: T) => boolean;
    readonly log?: Logger;
}

interface NewObserver {
    <T>(): Observer<T|undefined>;
    <T>(init: undefined, options?: ObserverOptions<T>): Observer<T|undefined>;
    <T>(init: T, options?: ObserverOptions<T>): Observer<T>;
}

export const observer = (<T>(init: T, options: ObserverOptions<T> = {}): Observer<T> => {
    const isEqual = options.isEqual || ((prev: T, next: T) => prev === next);
    const key = options.key || '';
    const name = options.name || (key + '$');
    const log = options.log || logger(name);

    log.d('new', init);

    const listeners: Listener<T>[] = [];

    let curr = init;

    const clear = () => {
        log.d('clear', listeners.length);
        listeners.length = 0;
    }

    const get: Getter<T> = () => curr;

    const next: Setter<T> = (value, force) => {
        try {
            if (isFun(value)) {
                value = value(get());
            }
            if (!force && isEqual(curr, value)) {
                return;
            }
            log.d('next', value);
            for (const listener of listeners) {
                try {
                    listener(value);
                }
                catch (e) { log.e('listener', listener, e) }
            }
        }
        catch (e) { log.e('next', value, e) }
    }

    const on: Subscribe<T> = (listener: Listener<T>, isRepeat) => {
        log.d('on', listener, isRepeat);
        if (isRepeat) {
            const repeat = get();
            log.d('on repeat', repeat);
            listener(repeat);
        }
        listeners.push(listener);
        return () => {
            removeItem(listeners, listener);
        }
    }

    return { key, listeners, clear, get, next, on };
}) as NewObserver;
