import { Obs } from './Obs';

interface NewObs {
  <T>(): Obs<T | undefined>;
  <T>(init: undefined): Obs<T | undefined>;
  <T>(init: undefined, key: string): Obs<T | undefined>;
  <T>(init: T): Obs<T>;
  <T>(init: T, key: string): Obs<T>;
}

export const newObs = (<T>(init: T, key: string): Obs<T> => new Obs(init, key)) as NewObs;
