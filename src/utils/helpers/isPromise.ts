import { isFun } from "./isFun";

export const isPromise = (v: any): v is Promise<any> => isFun(v?.then);