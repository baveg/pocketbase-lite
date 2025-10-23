
import { throttle } from './helpers/throttle';
import { debounce } from './helpers/debounce';
import { isDefined } from './helpers/isDefined';
import { isFun } from './helpers/isFun';
import { isPromise } from './helpers/isPromise';
import { toMe } from './helpers/toMe';
import { logger } from './logger';
import { Store } from './Store';
import { toError } from '@common/utils';

export type Listener<T> = (next: T) => void;
export type Unsubscribe = () => void;
export type Next<T> = T | ((prev: T) => T);

interface NewFlux {
  <T>(init?: undefined, key?: string): Flux<T | undefined>;
  <T>(init: T, key?: string): Flux<T>;
}
export const flux = (<T>(init: T, key: string): Flux<T> => new Flux(init, key)) as NewFlux;

export class Flux<T> {
  private static map: Record<string, Flux<any>> = {};

  static get<T>(factory: T | (() => T) | (() => Flux<T>), key?: string) {
    if (key) {
      const last = this.map[key];
      if (last) return last;
    }
    const value = isFun(factory) ? factory() : factory;
    const flux = value instanceof Flux ? value : new Flux<T>(value, key);
    if (key) {
      this.map[key] = flux;
    }
    return flux;
  }

  protected readonly log = logger(this.key + 'Observer');
  private readonly listeners: Listener<T>[] = [];
  private v: T;
  private isBinded?: boolean;

  constructor(
    init: T,
    public readonly key?: string
  ) {
    this.v = init;
    this.log.d('new', init);
  }

  isEqual(prev: T, next: T) {
    return prev === next;
  }

  get() {
    return this.v;
  }

  public get val() {
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

  notify() {
    this.set(this.get(), true);
  }

  bind() {
    if (!this.isBinded) {
      this.isBinded = true;
      this.get = this.get.bind(this);
      this.set = this.set.bind(this);
    }
    return this;
  }

  public get getter() {
    return this.bind().get;
  }

  public get setter() {
    return this.bind().set;
  }

  on(listener: Listener<T>, isRepeat?: boolean): Unsubscribe {
    this.log.d('on', listener, isRepeat);
    if (isRepeat) listener(this.get());
    this.listeners.push(listener);
    return () => this.off(listener);
  }

  off(listener: Listener<T>) {
    const listeners = this.listeners;
    const index = listeners.indexOf(listener);
    if (index !== -1) listeners.splice(index, 1);
    if (listeners.length === 0) this.clear();
    return this;
  }

  clear() {
    this.log.d('clear', this.listeners.length);
    this.listeners.length = 0;
  }

  async wait(filter: (value: T) => boolean = isDefined) {
    return new Promise<T>((resolve) => {
      const off = this.on((value) => {
        if (filter(value)) {
          off();
          resolve(value);
        }
      });
    });
  }
  
  store(check?: (value: T) => boolean) {
    const { key } = this;
    if (!key) throw toError('no key');
    const last = Store.get().get(key, this.get(), check);
    this.set(last);
    this.on((value) => Store.get().set(key, value));
    return this;
  }

  map<U>(convert: (value: T) => U | Promise<U>, reverse?: (value: U) => T): Pipe<T, U> {
    return new Pipe<T, U>(this, convert, reverse);
  }

  debounce(ms: number) {
    const target = this.map(toMe, toMe);
    target.sync = debounce(() => target.set(this.get()), ms);
    return target;
  }

  throttle(ms: number) {
    const target = this.map(toMe, toMe);
    target.sync = throttle(() => target.set(this.get()), ms);
    return target;
  }

  use(): [T, typeof this.set] {
    return [this.val, this.setter];
  }
}

export class Pipe<T, U> extends Flux<U> {
  private sourceOff?: () => void;
  private isInit?: boolean;

  constructor(
    public source: Flux<T>,
    public convert: (value: T) => U | Promise<U>,
    public reverse?: (value: U) => T,
  ) {
    super(undefined as any, source.key + 'Map');
  }

  sync() {
    this.isInit = true;

    const source = this.source.get();
    const result = this.convert(source);

    if (isPromise(result)) {
      result
        .then((v) => this.set(v))
        .catch((error) => {
          this.log.e('sync', source, result, error);
        });
    } else {
      this.set(result);
    }
  }

  get() {
    if (!this.isInit) this.sync();
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