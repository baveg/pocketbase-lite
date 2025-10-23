export type Fun = (...args: any[]) => any;

export const isFun = (v: any): v is Fun => typeof v === 'function';