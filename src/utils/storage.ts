import { glb } from './glb';
import { getLength } from './getLength';

export type Storage = typeof localStorage;

let storage: typeof localStorage;

export const newStorage = (): Storage => {
  const s: Storage & { length: number } = {
    data: {} as Record<string, string>,
    up: () => {
      s.length = getLength(s.data);
    },
    clear: () => {
      s.data = {};
      s.up();
    },
    getItem: (key: string) => s.data[key],
    setItem: (key: string, value: string) => {
      s.data[key] = value;
      s.up();
    },
    removeItem: (key: string) => {
      delete s.data[key];
      s.up();
    },
    key: (index: number) => Object.keys(s.data)[index] || null,
    length: 0,
  };
  return s;
};

export const getStorage = () => storage || (storage = glb.localStorage || newStorage());

export const setStorage = (value: typeof storage) => {
  storage = value;
};
