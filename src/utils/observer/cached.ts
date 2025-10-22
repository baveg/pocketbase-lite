import { isFun } from '../check';
import { Obs } from './Obs';

const cache: Record<string, Obs<any>> = {};

const create = <T>(key: string, init: T | (() => T) | (() => Obs<T>)) => {
  const value = isFun(init) ? init() : init;
  const obs = value instanceof Obs ? value : new Obs<T>(value, key);
  cache[key] = obs;
  return obs;
};

export const cached = <T>(key: string, init: T | (() => T) | (() => Obs<T>)) =>
  cache[key] || create(key, init);
