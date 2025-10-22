import { toMe } from '../to';
import { debounce } from './debounce';
import { mapped } from './mapped';
import { Observer } from './observer';

export const debounced = <T>(source: Observer<T>, ms: number): Observer<T> => {
  const target = mapped(source, toMe, toMe);
  const original = target.sync.bind(mapped);
  const fun = debounce(() => original(), ms);
  target.sync = () => fun(undefined);
  return target;
};
