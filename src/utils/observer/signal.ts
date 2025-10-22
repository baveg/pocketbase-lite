import { Obs } from './Obs';

export const signal = <T>(source: Obs<T>) => {
  source.set(source.get(), true);
};
