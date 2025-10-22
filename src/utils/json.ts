import { logger } from "./logger";

const log = logger('json');

export const jsonStringify = (value: any) => {
    try {
        return JSON.stringify(value);
    }
    catch (e) {
        log.e('stringify', e);
        return String(value);
    }
}

export const jsonParse = (text: string) => {
    try {
        return JSON.parse(text);
    }
    catch (e) {
        log.e('parse', e);
        return null;
    }
}