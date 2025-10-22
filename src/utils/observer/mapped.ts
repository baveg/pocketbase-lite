import { isFun, isPromise } from '../check';
import { Listener, Next, Observer } from './observer';

export class Mapped<T, U> extends Observer<U> {
  private sourceOff?: () => void;
  private isInit?: boolean;

  constructor(
    public source: Observer<T>,
    public convert: (value: T) => U | Promise<U>,
    public reverse?: (value: U) => T
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

export const mapped = <T, U>(
  source: Observer<T>,
  convert: (value: T) => U | Promise<U>,
  reverse?: (value: U) => T
) => {
  return new Mapped<T, U>(source, convert, reverse);
};
