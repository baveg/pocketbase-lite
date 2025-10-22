import { isDefined, isFun, isPromise } from "./check";
import { Logger, logger } from "./logger";
import { removeItem } from "./removeItem";
import { debounce } from "./debounce";
import { throttle } from "./throttle";
import { toMe } from "./to";

export type Listener<T> = (next: T) => void;
export type Unsubscribe = () => void;
export type Next<T> = T|((prev: T) => T);

export class Observer<T> {
    protected readonly log: Logger;
    private readonly listeners: Listener<T>[] = []
    private v: T;
    private isBind?: boolean;

    constructor(
        init: T,
        public readonly key: string,
    ) {
        this.v = init;
        this.log = logger(key + 'Observer');
        this.log.d('new', init);
    }

    isEqual(prev: T, next: T) {
        return prev === next;
    }

    bind() {
        if (!this.isBind) {
            this.isBind = true;
            this.get = this.get.bind(this);
            this.set = this.set.bind(this);
        }
        return this;
    }

    getter() {
        return this.bind().get;
    }

    setter() {
        return this.bind().set;
    }

    use(): [T, typeof this.set] {
        return [this.get(), this.setter()];
    }

    get() {
        return this.v;
    }

    public get val(): T {
        return this.get();
    }

    public set val(next: T) {
        this.set(next, true);
    }

    set(next: Next<T>, force?: boolean) {
        if (isFun(next)) next = next(this.get());
        if (!force && this.isEqual(this.v, next)) return;
        this.v = next;
        this.log.d('set', next);
        for (const listener of this.listeners) listener(next);
    }

    signal() {
        this.set(this.get(), true);
    }

    on(listener: Listener<T>, isRepeat?: boolean): Unsubscribe {
        this.log.d('on', listener, isRepeat);
        if (isRepeat) listener(this.get());
        this.listeners.push(listener);
        return () => {
            removeItem(this.listeners, listener);
            if (this.listeners.length === 0) this.clear();
        }
    }

    clear() {
        this.log.d('clear', this.listeners.length);
        this.listeners.length = 0;
    }

    map<U>(convert: (value: T) => U|Promise<U>, reverse?: (value: U) => T) {
        return new ObserverMap<T, U>(this, convert, reverse);
    }

    async wait(filter: (value: T) => boolean = isDefined) {
        return new Promise<T>(resolve => {
            const off = this.on(value => {
                if (filter(value)) {
                    off();
                    resolve(value);
                }
            });
        });
    }

    debounce(ms: number): Observer<T> {
        const mapped = this.map(toMe, toMe);
        const original = mapped.sync.bind(mapped);
        const debounced = debounce(() => original(), ms);
        mapped.sync = () => debounced(undefined);
        return mapped;
    }

    throttle(ms: number): Observer<T> {
        const mapped = this.map(toMe, toMe);
        const original = mapped.sync.bind(mapped);
        const throttled = throttle(() => original(), ms);
        mapped.sync = () => throttled(undefined);
        return mapped;
    }
}

export class ObserverMap<T, U> extends Observer<U> {
    private sourceOff?: () => void;
    private vSource?: T;

    constructor(
        public source: Observer<T>,
        public convert: (value: T) => U|Promise<U>,
        public reverse?: (value: U) => T,
    ) {
        super(undefined as any, source.key + 'Map');
    }

    sync() {
        const vSource = this.source.get();
        if (vSource === this.vSource) return;
        this.vSource = vSource;

        const result = this.convert(vSource);

        if (isPromise(result)) {
            result.then((value) => {
                this.set(value);
            }).catch((error) => {
                this.log.e('sync', vSource, result, error);
            });
        } else {
            this.set(result);
        }
    }

    get() {
        this.sync();
        return super.get();
    }

    set(next: Next<U>, force?: boolean) {
        if (!this.reverse) {
            this.log.e('set', 'no reverse');
            return;
        }
        if (isFun(next)) next = next(this.get());
        this.source.set(this.reverse(next), force);
    }

    on(listener: Listener<U>, isRepeat?: boolean) {
        const off = super.on(listener, isRepeat);

        if (!this.sourceOff) {
            this.log.d('connect');
            this.sourceOff = this.source.on(() => this.sync());
        }

        return off;
    }

    clear() {
        super.clear();

        if (this.sourceOff) {
            this.log.d('disconnect');
            this.sourceOff();
            this.sourceOff = undefined;
        }
    }
}

interface NewObserver {
    <T>(): Observer<T|undefined>;
    <T>(init: undefined): Observer<T|undefined>;
    <T>(init: undefined, key: string): Observer<T|undefined>;
    <T>(init: T): Observer<T>;
    <T>(init: T, key: string): Observer<T>;
}
export const observer = (<T>(init: T, key: string): Observer<T> => (
    new Observer(init, key)
)) as NewObserver;
