export const toVoid = () => {};

export const toTrue = () => true;

export const toFalse = () => false;

export const toMe = <T = any>(v: T): T => v;

export const toBool = (v: any) => !!v;

export const toError = (v: any) => (v instanceof Error ? v : new Error(String(v)));
