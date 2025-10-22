export type Fun = (...args: any[]) => any;

export const isArray = <T extends any>(v: any): v is T[] => Array.isArray(v);

export const isDefined = <T>(v: T | null | undefined): v is NonNullable<T> | null => v !== undefined;

export const isObject = <T extends Object>(v: unknown): v is T => typeof v === 'object' && v !== null;

export const isDictionary = <T extends Record<string, any> = Record<string, any>>(v: any): v is T => isObject(v) && !isArray(v);

export const isFun = (v: any): v is Fun => typeof v === 'function';

export const isString = (v: any): v is string => typeof v === 'string';

export const isNumber = (v: any): v is number => typeof v === 'number';

export const isBool = (v: any): v is boolean => v === true || v === false;

export const isBetween = (v: number, min?: number, max?: number): boolean =>
  isNumber(min) && v < min ? false : isNumber(max) && v > max ? false : true;

export type Check = (v: any) => boolean;

export const getCheck = (v: any): Check => (
    isString(v) ? isString :
    isNumber(v) ? isNumber :
    isBool(v) ? isBool :
    isArray(v) ? isArray :
    isDictionary(v) ? isDictionary :
    () => true
)

export class CheckError extends Error {
  constructor(prop?: string, type?: string) {
    super(`${prop || 'property'} is not ${type || 'valid'}`);
  }
}

export const checkError = (prop?: string, type?: string) => new CheckError(prop, type);