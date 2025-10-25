import { ReqParams, isArray, isDefined, jsonStringify } from "fluxio";
import { PbModelBase, PbWhere, PbOptions } from "./types";

export const pbFilter = <T extends PbModelBase>(where: PbWhere<T> | undefined): string | undefined => {
    if (!where) return undefined;

    const filters = Object.entries(where || {})
        .map(([key, propFilter]) => {
        if (!isDefined(propFilter)) return '';

        const [operator, operand] = isArray(propFilter) ? propFilter : ['=', propFilter];

        const operandString =
            typeof operand === 'string' ? `"${operand}"`
            : operand instanceof Date ? jsonStringify(operand)
            : operand;

        return `${key} ${operator} ${operandString}`;
        })
        .filter((f) => f);
    if (filters.length === 0) return undefined;

    return `(${filters.join(' && ')})`;
}

export interface PbParams extends ReqParams {
    sort?: string;
    fields?: string;
    expand?: string;
    page?: string;
    perPage?: string;
    skipTotal?: string;
    filter?: string;
}

export const pbParams = <T extends PbModelBase>(o: PbOptions<T>): PbParams => {
    const p: PbParams = {};

    let v: any;

    if ((v = o.orderBy)) p.sort = v.join(',');
    if ((v = o.select)) p.fields = v.join(',');
    if ((v = o.expand)) p.expand = v;
    if ((v = o.page)) p.page = v;
    if ((v = o.perPage)) p.perPage = v;
    if ((v = o.skipTotal)) p.skipTotal = 'true';
    if ((v = o.where)) p.filter = pbFilter(v);
    if ((v = o.req?.params)) Object.assign(p, v);

    return p;
}