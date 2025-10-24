import { isArray, isDefined, jsonStringify, toError, Logger, logger, count, ReqMethod, ReqOptions, ReqParams } from 'fluxio';
import { PbOptions, PbCreate, PbKeys, PbModelBase, PbPage, PbUpdate, PbWhere } from './pbTypes';
import { PbClient } from './PbClient';

export class PbColl<T extends PbModelBase> {
  public readonly name: string;
  public log: Logger;

  constructor(
    public client: PbClient,
    name: string
  ) {
    this.name = name;
    this.log = logger(name + 'Coll');
  }

  getFilter(where: PbWhere<T> | undefined): string | undefined {
    if (!where) return undefined;

    const filters = Object.entries(where || {})
      .map(([key, propFilter]) => {
        if (!isDefined(propFilter)) return '';

        const [operator, operand] = isArray(propFilter) ? propFilter : ['=', propFilter];

        const operandString =
          typeof operand === 'string'
            ? `"${operand}"`
            : operand instanceof Date
              ? jsonStringify(operand)
              : operand;

        return `${key} ${operator} ${operandString}`;
      })
      .filter((f) => f);
    if (filters.length === 0) return undefined;

    return `(${filters.join(' && ')})`;
  }

  private reqOptions(method: ReqMethod, idOrUrl: string, o: PbOptions<T>): ReqOptions {
    const url =
      idOrUrl.indexOf('/') === -1
        ? `collections/${this.name}/records${idOrUrl ? `/${idOrUrl}` : ''}`
        : idOrUrl;
    let result: ReqOptions = { method, url, ...o.req };

    const p: ReqParams = {};

    let v: any;

    if ((v = o.orderBy)) p.sort = v.join(',');
    if ((v = o.select)) p.fields = v.join(',');
    if ((v = o.expand)) p.expand = v;
    if ((v = o.page)) p.page = v;
    if ((v = o.perPage)) p.perPage = v;
    if ((v = o.skipTotal)) p.skipTotal = 'true';
    if ((v = o.where)) p.filter = this.getFilter(v);
    if ((v = o.req?.params)) Object.assign(p, v);

    if (count(p) > 0) result.params = { ...p, ...result.params };
    if ((v = o.data)) result.form = v;

    result = this.client.reqOptions(result);

    this.log.d('reqOptions', method, idOrUrl, o, result);

    return result;
  }

  call(method: ReqMethod, idOrUrl: string, o: PbOptions<T> = {}) {
    this.log.d('call', method, idOrUrl, o);
    const reqOptions = this.reqOptions(method, idOrUrl, o);
    return this.client.req(reqOptions).catch((error) => {
      this.log.w('call error', error);
      throw error;
    });
  }

  get(id: string, o: PbOptions<T> = {}): Promise<T | null> {
    this.log.d('get', id, o);
    if (!id) return Promise.resolve(null);
    return this.call('GET', id, o);
  }

  page(where: PbWhere<T>, page: number, perPage: number, o: PbOptions<T> = {}): Promise<PbPage<T>> {
    this.log.d('page', where, page, perPage, o);
    return this.call('GET', '', { where, page, perPage, ...o });
  }

  filter(where: PbWhere<T>, o: PbOptions<T> = {}) {
    this.log.d('filter', where, o);
    return this.page(where, 1, 100, { skipTotal: false, ...o });
  }

  all(where: PbWhere<T>, o: PbOptions<T> = {}) {
    this.log.d('all', where, o);
    return this.page(where, 1, 99999, o).then((r) => r.items);
  }

  one(where: PbWhere<T>, o: PbOptions<T> = {}): Promise<T | null> {
    this.log.d('one', where, o);
    return this.page(where, 1, 1, o).then((r) => r.items[0] || null);
  }

  findId(where: PbWhere<T>, o: PbOptions<T> = {}): Promise<string | null> {
    this.log.d('findId', where, o);
    return this.page(where, 1, 1, { select: ['id' as PbKeys<T>], ...o }).then(
      (r) => r.items[0]?.id || null
    );
  }

  count(where: PbWhere<T>, o: PbOptions<T> = {}) {
    this.log.d('count', where, o);
    return this.page(where, 1, 1, { select: [], skipTotal: false, ...o }).then((r) => r.totalItems);
  }

  create(data: PbCreate<T>, o: PbOptions<T> = {}): Promise<T> {
    this.log.i('create', data, o);
    return this.call('POST', '', { data, ...o }).catch((error) => {
      this.log.w('create error', error);
      throw error;
    });
  }

  update(id: string, data: PbUpdate<T>, o: PbOptions<T> = {}): Promise<T | null> {
    this.log.i('update', id, data, o);
    if (!id) throw toError('no id');
    return this.call('PATCH', id, { data, ...o }).catch((error) => {
      this.log.w('update error', error);
      throw error;
    });
  }

  up(id: string, changes: PbUpdate<T>, o: PbOptions<T> = {}) {
    this.log.d('up', id, changes, o);
    return this.update(id, changes, { ...o, select: [] }).then(Boolean);
  }

  delete(id: string, o: PbOptions<T> = {}): Promise<void> {
    this.log.i('delete', id, o);
    if (!id) throw toError('no id');
    return this.call('DELETE', id, { ...o, req: { resType: 'text', ...o.req } }).catch((error) => {
      this.log.w('delete error', error);
      throw error;
    });
  }

  upsert(where: PbWhere<T>, changes: PbCreate<T>, o: PbOptions<T> = {}) {
    this.log.d('upsert', where, changes, o);
    return this.findId(where).then((id) =>
      id ? (this.update(id, changes, o) as Promise<T>) : this.create(changes, o)
    );
  }

  // getFileParams(thumb?: number|string, download?: boolean, params?: Record<string, string>) {
  //   const p: Record<string, string> = {};
  //   let v: any;
  //   if (thumb) p.thumb = isNumber(v) ? `${v}x${v}` : v;
  //   if (download) p.download = '1';
  //   if (params) Object.assign(p, params);
  //   return p;
  // }

  // getFile(id?: string, filename?: any, o: FileUrlOptions = {}): Promise<Blob|null> {
  //   if (!id || !filename) return Promise.resolve(null);
  //   return this.call('GET', `files/${this.name}/${id}/${filename}`, {
  //     req: {
  //       params: getFileParams()
  //       resType: 'blob',
  //       ...o.req
  //     },
  //     ...o
  //   });
  // }

  // getFileUrl(id?: string, filename?: any, thumb?: number|string, download?: boolean, params?: Record<string, string>) {
  //   if (!id || !filename) return '';

  //   const clientUrl = this.client.url$.get();
  //   const url = pathJoin(clientUrl, `files/${this.name}/${id}/${filename}`);

  //   const p = this.getFileParams()
  //   const params: ReqParams = { ...o.req?.params };
  //   if (getLength(params) > 0) url = updateUrlParams(url, params);

  //   this.log.d('getFileUrl', id, filename, o, url);
  //   return url;
  // }

  // getDownloadUrl(id?: string, filename?: any, o: FileUrlOptions = {}) {
  //   return this.getFileUrl(id, filename, { ...o, download: true });
  // }

  // on(
  //   cb: (item: T, action: 'update' | 'create' | 'delete') => void,
  //   topic: string = '*',
  //   o: PbOptions<T> = {},
  // ) {
  //   console.debug('on', this.name, topic, o);
  //   // 'devices/8e2mu4rr32b0glf?options={"headers": {"x-token": "..."}}'

  //   const key = `${this.name}/${topic}`;

  //   // const req = this.reqOptions('GET', `${this.name}/${topic}`, {
  //   //   ...o,
  //   //   req: {
  //   //     ...o.req,
  //   //     params: {
  //   //       options: {
  //   //         query: p.query,
  //   //         headers: p.headers,
  //   //       },
  //   //       ...o.req?.params,
  //   //     },
  //   //   }
  //   // });

  //   const listener = (event: MessageEvent) => {
  //     // console.debug('subscribe listener', this.coll, key, event);
  //     const payload = jsonParse(event.data);
  //     const record = (payload ? payload.record : null) || payload;
  //     const id = (record ? record.id : null) || record;
  //     console.debug('subscribe listener payload', this.name, key, id);
  //     cb(record, payload.action);
  //   };

  //   const subscriptions = realtime.subscriptions;
  //   const listeners = subscriptions[key] || (subscriptions[key] = []);
  //   listeners.push(listener);

  //   realtime.update(this.r);

  //   return () => {
  //     const listeners = subscriptions[key] || subscriptions[key] || [];
  //     removeItem(listeners, listener);
  //     realtime.update(this.r);
  //   };
  // }
}
