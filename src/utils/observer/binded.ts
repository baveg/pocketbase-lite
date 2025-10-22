import { Obs } from './Obs';

export const binded = <T>(source: Obs<T>): Obs<T> => {
  if (!(source as any).isBinded) {
    (source as any).isBinded = true;
    source.get = source.get.bind(source);
    source.set = source.set.bind(source);
  }
  return source;
};

export const getter = <T>(source: Obs<T>) => binded(source).get;
export const setter = <T>(source: Obs<T>) => binded(source).set;
