import { throttle } from './helpers/throttle';
import { debounce } from './helpers/debounce';
import { isDefined } from './helpers/isDefined';
import { isFun } from './helpers/isFun';
import { toVoid } from './helpers/toVoid';
import { toError } from './helpers/toError';
import { logger } from './logger';
import { Store } from './Store';

export type Listener<T> = (next: T) => void;
export type Unsubscribe = () => void;
export type Next<T> = T | ((prev: T) => T);

// Type utilities for Flux tuples
type UnwrapFlux<T extends readonly Flux<any>[]> = {
  [K in keyof T]: T[K] extends Flux<infer U> ? U : never
};

interface NewFlux {
  <T>(init?: undefined, key?: string): Flux<T | undefined>;
  <T>(init: T, key?: string): Flux<T>;
}
export const flux = (<T>(init: T, key: string): Flux<T> => new Flux(init, key)) as NewFlux;

/**
 * Reactive state container with observable pattern.
 * Supports subscriptions, transformations, and persistence.
 */
export class Flux<T=any> {
  private static map: Record<string, Flux<any>> = {};

  /**
   * Get or create a singleton Flux instance by key.
   * @param factory Value, factory function, or Flux factory
   * @param key Optional unique key for singleton lookup
   * @returns Existing or new Flux instance
   */
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

  /**
   * Combine multiple Flux instances into a single Pipe that emits tuples.
   * Updates whenever any source Flux changes.
   * @param sources Array of Flux instances to combine
   * @param key Optional key for the combined Pipe
   * @returns Pipe emitting tuple of all source values
   * @example
   * const name$ = flux('John');
   * const age$ = flux(30);
   * const combined$ = Flux.combine([name$, age$]);
   * combined$.on(([name, age]) => console.log(name, age));
   */
  static combine<const Sources extends readonly Flux<any>[]>(
    sources: Sources,
    key?: string
  ): Pipe<UnwrapFlux<Sources>> {
    if (!key) key = sources.map(f => f.key).join('+');
    return new Pipe(
      (listener) => {
        const offs: Unsubscribe[] = [];
        for (const source of sources) offs.push(source.on(listener));
        return () => {
          for (const off of offs) off();
          offs.length = 0;
        }
      }, (pipe) => {
        pipe.set(sources.map(s => s.get()) as UnwrapFlux<Sources>);
      }, (pipe) => {
        const values = pipe.get();
        if (Array.isArray(values)) values.forEach((v: any, i) => sources[i]!.set(v));
      },
      key
    );
  }

  public readonly log = logger(this.key || 'Flux');
  public readonly listeners: Listener<T>[] = [];
  private v: T;
  private isBinded?: boolean;

  constructor(
    init: T,
    public readonly key?: string
  ) {
    this.v = init;
    this.log.d('new', init);
  }

  /**
   * Compares two values for equality. Override for custom equality logic.
   * @param prev Previous value
   * @param next Next value
   * @returns True if values are equal
   */
  isEqual(prev: T, next: T) {
    return prev === next;
  }

  /**
   * Get the current value.
   * @returns Current value
   */
  get() {
    return this.v;
  }

  /**
   * Returns the current value for JSON serialization.
   * Allows Flux to be used directly in JSON.stringify().
   * @example
   * const flux$ = flux({ a: 1, b: 2 });
   * JSON.stringify(flux$) // '{"a":1,"b":2}'
   */
  toJSON() {
    return this.get();
  }

  /**
   * Returns the string representation of the current value.
   * Allows Flux to be used in string contexts.
   * @example
   * const flux$ = flux('hello');
   * String(flux$) // 'hello'
   * flux$ + ' world' // 'hello world'
   * const num$ = flux(42);
   * String(num$) // '42'
   */
  toString() {
    return String(this.get());
  }

  /**
   * Getter property for current value.
   * @returns Current value
   */
  public get val() {
    return this.get();
  }

  /**
   * Setter property that forces notification.
   * @param next New value
   */
  public set val(next: T) {
    this.set(next, true);
  }

  /**
   * Set a new value and notify listeners if changed.
   * @param next New value or updater function
   * @param force Force notification even if value hasn't changed
   */
  set(next: Next<T>, force?: boolean) {
    if (isFun(next)) next = next(this.get());
    if (!force && this.isEqual(this.v, next)) return;
    this.v = next;
    this.log.d('set', next);
    for (const listener of this.listeners) listener(next);
  }

  /**
   * Forces notification of all listeners without changing the value.
   * Useful when the internal state has mutated but the reference is the same.
   */
  notify() {
    this.set(this.get(), true);
  }

  /**
   * Bind get and set methods to this instance.
   * Useful for passing methods as callbacks.
   * @returns This instance for chaining
   */
  bind() {
    if (!this.isBinded) {
      this.isBinded = true;
      this.get = this.get.bind(this);
      this.set = this.set.bind(this);
    }
    return this;
  }

  /**
   * Get bound getter function.
   * @returns Bound get method
   */
  public get getter() {
    return this.bind().get;
  }

  /**
   * Get bound setter function.
   * @returns Bound set method
   */
  public get setter() {
    return this.bind().set;
  }

  /**
   * Subscribe to value changes.
   * @param listener Callback function to receive new values
   * @param isRepeat If true, immediately call listener with current value
   * @returns Unsubscribe function
   */
  on(listener: Listener<T>, isRepeat?: boolean): Unsubscribe {
    this.log.d('on', listener, isRepeat);
    if (isRepeat) listener(this.get());
    this.listeners.push(listener);
    return () => this.off(listener);
  }

  /**
   * Unsubscribe a specific listener.
   * @param listener Listener function to remove
   * @returns This instance for chaining
   */
  off(listener: Listener<T>) {
    const listeners = this.listeners;
    const index = listeners.indexOf(listener);
    if (index !== -1) listeners.splice(index, 1);
    if (listeners.length === 0) this.clear();
    return this;
  }

  /**
   * Remove all listeners.
   */
  clear() {
    this.log.d('clear', this.listeners.length);
    this.listeners.length = 0;
  }

  /**
   * Wait for a value that passes the filter condition.
   * @param filter Predicate function to test values
   * @returns Promise that resolves with the matching value
   * @example
   * const user$ = flux(null);
   * const user = await user$.wait(); // Waits for non-null value
   */
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
  
  /**
   * Persist Flux value to localStorage and sync changes.
   * Requires a key to be set on the Flux instance.
   * @param check Optional validation function for stored value
   * @returns This instance for chaining
   * @example
   * const count$ = flux(0, 'counter');
   * count$.store(); // Loads from localStorage and auto-saves changes
   */
  store(check?: (value: T) => boolean) {
    const { key } = this;
    if (!key) throw toError('no key');
    const last = Store.get().get(key, this.get(), check);
    this.set(last, true);
    this.on((value) => Store.get().set(key, value));
    return this;
  }

  /**
   * Creates a bidirectional pipe with custom sync logic.
   * @param sync Function called to sync source value to pipe
   * @param onSet Function called when pipe value is set (for reverse sync)
   * @param key Optional key for the pipe
   * @returns A new Pipe instance
   */
  pipe<U=T>(sync: (pipe: Pipe<U, T>) => void, onSet?: (pipe: Pipe<U, T>, value: U) => void, key?: string) {
    return new Pipe<U, T>(this, sync, onSet, key);
  }

  /**
   * Transform values with a mapping function.
   * @param convert Function to transform values
   * @param reverse Optional reverse transform for bidirectional sync
   * @returns Pipe with transformed values
   * @example
   * const count$ = flux(5);
   * const doubled$ = count$.map(n => n * 2, n => n / 2);
   * doubled$.get() // 10
   */
  map<U>(convert: (value: T) => U, reverse?: (value: U) => T) {
    return this.pipe<U>(pipe => {
      pipe.set(convert(this.get()));
    }, reverse ? (pipe, value) => {
      this.set(reverse(value))
    } : undefined, this.key + 'Map');
  }

  /**
   * Transform values asynchronously with a mapping function.
   * @param convert Async function to transform values
   * @param reverse Optional async reverse transform
   * @returns Pipe with async transformed values
   * @example
   * const userId$ = flux(123);
   * const user$ = userId$.mapAsync(id => fetchUser(id));
   */
  mapAsync<U>(convert: (value: T) => Promise<U>, reverse?: (value: U) => Promise<T>) {
    return this.pipe<U>(pipe => {
      convert(this.get()).then(pipe.setter).catch((error) => {
        pipe.log.e('convert', convert, error);
      });
    }, reverse ? (pipe, value) => {
      reverse(value).then(this.setter).catch((error) => {
        pipe.log.e('reverse', reverse, error);
      });
    } : undefined, this.key + 'MapAsync');
  }

  /**
   * Debounce emissions - only emit after silence period.
   * @param ms Milliseconds to wait after last emission
   * @returns Debounced Pipe
   * @example
   * const search$ = flux('');
   * const debounced$ = search$.debounce(300);
   * // Only emits 300ms after user stops typing
   */
  debounce(ms: number) {
    return this.pipe(debounce((pipe: Pipe<T, T>) => {
      pipe.set(this.get())
    }, ms), undefined, this.key + 'Debounce');
  }

  /**
   * Throttle emissions - emit at most once per time period.
   * @param ms Minimum milliseconds between emissions
   * @returns Throttled Pipe
   * @example
   * const scroll$ = flux(0);
   * const throttled$ = scroll$.throttle(100);
   * // Emits at most once every 100ms
   */
  throttle(ms: number) {
    return this.pipe(throttle((pipe: Pipe<T, T>) => {
      pipe.set(this.get());
    }, ms), undefined, this.key + 'Throttle');
  }

  /**
   * Delay emissions by specified time.
   * @param ms Milliseconds to delay
   * @returns Delayed Pipe
   */
  delay(ms: number): Pipe<T, T> {
    return this.pipe((pipe) => {
      setTimeout(() => pipe.set(this.get()), ms);
    }, undefined, this.key + 'Delay');
  }

  /**
   * Creates a new Flux that only emits values that pass the filter predicate.
   * @param predicate Function that tests each value
   * @returns A new Pipe that only emits filtered values
   */
  filter(predicate: (value: T) => boolean) {
    return this.pipe((pipe) => {
      const value = this.get();
      if (predicate(value)) {
        pipe.set(value);
      }
    }, undefined, this.key + 'Filter');
  }

  /**
   * React-style hook return: [value, setter].
   * Useful for destructuring in components.
   * @returns Tuple of current value and setter function
   * @example
   * const [count, setCount] = count$.use();
   */
  use(): [T, typeof this.set] {
    return [this.val, this.setter];
  }

  /**
   * Apply an accumulator function, emitting each intermediate result.
   * Similar to Array.reduce but emits all intermediate values.
   * 
   * @example
   * const count$ = flux(1);
   * const sum$ = count$.scan((acc, n) => acc + n, 0);
   * // count$ changes: 1 → 2 → 3
   * // sum$ emits:     1 → 3 → 6
   */
  scan<U>(accumulator: (acc: U, value: T) => U, seed: U) {
    let acc = seed;
    return this.pipe<U>((pipe) => {
      acc = accumulator(acc, this.get());
      pipe.set(acc);
    }, undefined, this.key + 'Scan');
  }
}

export class Pipe<T=any, U=T> extends Flux<T> {
  private sourceOff?: () => void;
  public isInit?: boolean;

  constructor(
    public readonly source: Flux<U>|((listener: () => void) => Unsubscribe),
    public readonly sync: (pipe: Pipe<T, U>) => void,
    public readonly onSet: (pipe: Pipe<T, U>, value: T) => void = toVoid,
    key?: string,
  ) {
    super(undefined as T, key || 'Pipe');
  }

  get() {
    if (!this.isInit) {
      this.isInit = true;
      this.sync(this);
    }
    return super.get();
  }

  set(next: Next<T>, force?: boolean) {
    if (isFun(next)) next = next(this.get());
    super.set(next, force);
    this.onSet(this, next);
  }

  on(listener: Listener<T>, isRepeat?: boolean) {
    const off = super.on(listener, isRepeat);

    if (!this.sourceOff) {
      this.log.d('connect');
      const listener = () => {
        this.isInit = true;
        this.sync(this)
      };
      this.sourceOff = isFun(this.source) ? this.source(listener) : this.source.on(listener);
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