import { Observer } from './observer';

export const signal = <T>(source: Observer<T>) => {
  source.set(source.get(), true);
};
