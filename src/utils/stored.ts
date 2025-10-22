import { CheckError, getCheck } from './check';
import { observer } from './observerFun';
import { getStorage } from './storage';
import { toError } from './to';

export const stored$ = observer<[string, any]>(undefined, { key: 'stored' });

let prefix = '';

export const setStoredPrefix = (value: string) => {
  const data = getStoredData();
  prefix = value;
  updateStoredData(data);
};

export const getStoredPrefix = () => prefix;

export const getStored = <T = any>(key: string, init: T, check = getCheck(init)): T => {
  try {
    const storage = getStorage();
    const json = storage.getItem(prefix + key);
    let value = json ? JSON.parse(json) : undefined;
    if (value !== undefined && !check(value)) {
      throw new CheckError(key, value);
    }
    return value !== undefined ? value : init;
  } catch (error) {
    console.error('getStored error', key, toError(error));
    return init;
  }
};

export const setStored = <T = any>(key: string, value?: T): void => {
  try {
    const storage = getStorage();

    if (value === undefined) {
      storage.removeItem(prefix + key);
      return;
    }

    const json = JSON.stringify(value);
    if (json === undefined) {
      console.error('setStored', key, value);
      return;
    }

    storage.setItem(prefix + key, json);

    stored$.next([key, value]);
  } catch (e) {
    const error = toError(e);
    console.error('setStored error', key, value, error);
  }
};

export const getStoredKeys = (): string[] => {
  const storage = getStorage();
  const keys = [];
  for (let i = 0, l = storage.length; i < l; i++) {
    const fullKey = storage.key(i);
    if (fullKey?.startsWith(prefix)) {
      keys.push(fullKey.slice(prefix.length));
    }
  }
  return keys;
};

export const getStoredData = (): Record<string, any> => {
  const keys = getStoredKeys();
  const result = {} as Record<string, any>;
  for (const key of keys) {
    result[key] = getStored(key, undefined);
  }
  return result;
};

export const clearStoredData = (): void => {
  const keys = getStoredKeys();
  for (const key of keys) {
    setStored(key, undefined);
  }
};

export const updateStoredData = (data: Record<string, any>) => {
  for (const key in data) {
    setStored(key, data[key]);
  }
};

export const replaceStoredData = (data: Record<string, any>) => {
  clearStoredData();
  updateStoredData(data);
};
