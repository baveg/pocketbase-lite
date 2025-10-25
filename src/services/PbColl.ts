import {
  toError,
  Logger,
  logger,
  count,
  ReqMethod,
  isNumber,
  pathJoin,
  setUrlParams,
} from 'fluxio';
import { PbOptions, PbCreate, PbKeys, PbModelBase, PbPage, PbUpdate, PbWhere } from './types';
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

  getUrl(id: string) {
    return `collections/${this.name}/records${id ? `/${id}` : ''}`;
  }

  call(method: ReqMethod, idOrUrl: string, o: PbOptions<T> = {}) {
    this.log.d('call', method, idOrUrl, o);
    const url = idOrUrl.includes('/') ? this.getUrl(idOrUrl) : idOrUrl;
    return this.client.req(method, url, o).catch((error) => {
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

  /**
   * Build file URL parameters for thumb size, download flag, and custom params
   * @param thumb Thumbnail size (number for square, string for custom dimensions)
   * @param download Whether to force download
   * @param params Additional URL parameters
   * @returns URL parameters object
   */
  getFileParams(thumb?: number | string, download?: boolean, params?: Record<string, string>) {
    const p: Record<string, string> = {};
    if (thumb) p.thumb = isNumber(thumb) ? `${thumb}x${thumb}` : thumb;
    if (download) p.download = '1';
    if (params) Object.assign(p, params);
    return p;
  }

  /**
   * Download a file as a Blob
   * @param id Record ID
   * @param filename Filename to download
   * @param thumb Thumbnail size (optional)
   * @param download Force download flag (optional)
   * @param params Additional URL parameters (optional)
   * @returns Promise resolving to Blob or null if id/filename missing
   */
  getFile(
    id?: string,
    filename?: string,
    thumb?: number | string,
    download?: boolean,
    params?: Record<string, string>
  ): Promise<Blob | null> {
    if (!id || !filename) return Promise.resolve(null);
    return this.call('GET', this.getFileUrl(id, filename, thumb, download, params), {
      req: { resType: 'blob' },
    });
  }

  /**
   * Get the URL for a file
   * @param id Record ID
   * @param filename Filename
   * @param thumb Thumbnail size (optional)
   * @param download Force download flag (optional)
   * @param params Additional URL parameters (optional)
   * @returns File URL string or empty string if id/filename missing
   */
  getFileUrl(
    id?: string,
    filename?: string,
    thumb?: number | string,
    download?: boolean,
    params?: Record<string, string>
  ) {
    if (!id || !filename) return '';

    const clientUrl = this.client.url$.get();
    let url = pathJoin(clientUrl, `files/${this.name}/${id}/${filename}`);

    const p = this.getFileParams(thumb, download, params);
    if (count(p) > 0) url = setUrlParams(url, p);

    this.log.d('getFileUrl', id, filename, thumb, download, params, url);
    return url;
  }

  /**
   * Get the download URL for a file (forces download)
   * @param id Record ID
   * @param filename Filename
   * @param thumb Thumbnail size (optional)
   * @param params Additional URL parameters (optional)
   * @returns Download URL string
   */
  getDownloadUrl(
    id?: string,
    filename?: string,
    thumb?: number | string,
    params?: Record<string, string>
  ) {
    return this.getFileUrl(id, filename, thumb, true, params);
  }
}
