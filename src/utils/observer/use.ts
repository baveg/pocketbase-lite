import { setter } from './binded';
import { Obs } from './Obs';

export const use = <T>(source: Obs<T>): [T, typeof source.set] => [source.get(), setter(source)];
