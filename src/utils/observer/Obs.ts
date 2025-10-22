import { isDefined, isFun, isPromise } from '../check';
import { Logger, logger } from '../logger';
import { removeItem } from '../removeItem';

export type Listener<T> = (next: T) => void;
export type Unsubscribe = () => void;
export type Next<T> = T | ((prev: T) => T);

export class Obs<T> {
  protected readonly log: Logger;
  private readonly listeners: Listener<T>[] = [];
  private v: T;

  constructor(
    init: T,
    public readonly key: string
  ) {
    this.v = init;
    this.log = logger(key + 'Observer');
    this.log.d('new', init);
  }

  isEqual(prev: T, next: T) {
    return prev === next;
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

  on(listener: Listener<T>, isRepeat?: boolean): Unsubscribe {
    this.log.d('on', listener, isRepeat);
    if (isRepeat) listener(this.get());
    this.listeners.push(listener);
    return () => {
      removeItem(this.listeners, listener);
      if (this.listeners.length === 0) this.clear();
    };
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
}
