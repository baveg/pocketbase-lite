import { Check } from '../check';
import { Obs } from './Obs';
import { newObs } from './newObs';
import { getStored, setStored } from '../stored';

interface NewObserverStored {
  <T>(init: undefined, key: string, check?: Check): Obs<T | undefined>;
  <T>(init: T, key: string, check?: Check): Obs<T>;
}
export const stored = (<T>(init: T, key: string, check?: Check) => {
  const target = newObs(init, key);
  const last = getStored(key, target.get(), check);
  target.set(last);
  target.on((value) => setStored(target.key, value));
  return target;
}) as NewObserverStored;
