import { ReqParams } from "fluxio";
import { PbModelBase, PbOptions } from "./types";
import { getFilter } from "./getFilter";

export interface PbParams extends ReqParams {
    sort?: string;
    fields?: string;
    expand?: string;
    page?: string;
    perPage?: string;
    skipTotal?: string;
    filter?: string;
}

export const getPbParams = <T extends PbModelBase>(o: PbOptions<T>): PbParams => {
    const p: PbParams = {};

    let v: any;

    if ((v = o.orderBy)) p.sort = v.join(',');
    if ((v = o.select)) p.fields = v.join(',');
    if ((v = o.expand)) p.expand = v;
    if ((v = o.page)) p.page = v;
    if ((v = o.perPage)) p.perPage = v;
    if ((v = o.skipTotal)) p.skipTotal = 'true';
    if ((v = o.where)) p.filter = getFilter(v);
    if ((v = o.req?.params)) Object.assign(p, v);

    return p;
}