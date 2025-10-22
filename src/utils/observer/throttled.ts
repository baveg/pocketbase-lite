import { toMe } from '../to';
import { mapped } from './mapped';
import { Obs } from './Obs';
import { throttle } from './throttle';

export const throttled = <T>(source: Obs<T>, ms: number): Obs<T> => {
  const target = mapped(source, toMe, toMe);
  const original = target.sync.bind(mapped);
  const fun = throttle(() => original(), ms);
  target.sync = () => fun(undefined);
  return target;
};
