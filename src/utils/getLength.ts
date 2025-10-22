import { isArray, isString, isObject } from "./check";

export const getLength = (items: any): number =>
    isArray(items) ? items.length :
    isString(items) ? items.length :
    isObject(items) ? Object.keys(items).length :
    0;