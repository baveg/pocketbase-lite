import { req } from 'fluxio/req/req';
import { ReqError } from 'fluxio/req/ReqError';
import { Dictionary, isDictionary } from 'fluxio/check/isDictionary';
import { isString } from 'fluxio/check/isString';
import { flux } from 'fluxio/flux/Flux';
import { fluxStored } from 'fluxio/flux/fluxStored';
import { logger } from 'fluxio/logger/Logger';
import { toError } from 'fluxio/cast/toError';
import { isNumber } from 'fluxio/check/isNumber';
import { pathJoin } from 'fluxio/url/pathJoin';
import { ReqMethod, ReqOptions } from 'fluxio/req/types';
import { toDate } from 'fluxio/cast/toDate';
import { PbAuth, PbModel, PbOptions } from './types';
import { pbParams } from './pbParams';
import { count } from 'fluxio/object/count';
import { setUrlParams } from 'fluxio/url/setUrlParams';

export const isPbAuth = (v: any): v is PbAuth =>
  isDictionary(v) && isString(v.token) && isString(v.coll) && isString(v.id);

export class PbClient {
  log = logger(this.key);
  error$ = flux<ReqError<any> | null>(null);
  auth$ = fluxStored<PbAuth | undefined>(this.key + 'Auth$', undefined, isPbAuth);
  url$ = fluxStored<string>(this.key + 'Url$', '', isString);
  offset$ = fluxStored<number>(this.key + 'Offset$', 0, isNumber);
  timeoutMs = 10000;
  _realtime?: any;

  constructor(public readonly key: string = 'pbClient') {
    this.error$.on((error) => this.log.d('error', error));
    this.auth$.on((auth) => this.log.d('auth', auth));
    this.url$.on((url) => this.log.d('url', url));
    this.initServerTime();
  }

  getApiUrl() {
    return this.url$.get();
  }

  /**
   * Set the API base URL
   * @param url The base URL for API requests
   */
  setApiUrl(url: string) {
    this.log.d('setUrl', url);
    this.url$.set(url);
    this.initServerTime();
  }

  /**
   * Get the current API base URL
   * @returns The base URL string
   */
  getUrl(path?: string, params?: Dictionary<string>) {
    const apiUrl = this.getApiUrl() || '/api/';
    let url = path ? pathJoin(apiUrl, path) : apiUrl;
    if (count(params) > 0) url = setUrlParams(url, params);
    this.log.d('getUrl', apiUrl, path, params, url);
    return url;
  }

  /**
   * Set the authentication token and user info
   * @param auth Authentication object with token and id, or undefined to clear
   * @returns The auth object that was set
   */
  setAuth(auth: PbAuth | undefined) {
    this.log.d('setAuth', auth);
    if (auth) {
      if (!isString(auth.token)) throw toError('no auth token');
      if (!isString(auth.id)) throw toError('no auth id');
    }
    this.auth$.set(auth);
    return auth;
  }

  /**
   * Get the current authentication object
   * @returns The current auth object or undefined
   */
  getAuth() {
    return this.auth$.get();
  }

  getAuthId() {
    return this.getAuth()?.id;
  }

  /**
   * Get the current authentication token
   * @returns The token string or empty string if not authenticated
   */
  getToken() {
    return this.getAuth()?.token || '';
  }

  getAuthHeaders() {
    const token = this.getToken();
    return {
      Authorization: `Bearer ${token}`,
      'X-Auth-Token': token,
    };
  }

  /**
   * Build request options with authentication headers and base URL
   * @param options Partial request options to merge
   * @returns Complete request options with auth headers
   */
  getReqOptions<T extends PbModel>(
    method: ReqMethod,
    url: string,
    o: PbOptions<T> = {}
  ): ReqOptions {
    const result: ReqOptions = {
      baseUrl: this.getUrl(),
      method,
      url,
      onError: this.error$.setter(),
      timeout: this.timeoutMs,
      form: o.data,
      ...o.req,
      params: pbParams(o),
      headers: {
        ...this.getAuthHeaders(),
        ...o.req?.headers,
      },
    };

    this.log.d('reqOptions', method, url, o, result);

    return result;
  }

  /**
   * Make an HTTP request with authentication
   * @param options Request options
   * @returns Promise resolving to the response data
   */
  req<T extends PbModel>(method: ReqMethod, idOrUrl: string, o: PbOptions<T> = {}) {
    const reqOptions = this.getReqOptions(method, idOrUrl, o);
    return req(reqOptions).catch((error) => {
      this.log.w('req error', error);
      throw error;
    });
  }

  /**
   * Synchronize server time with local time and calculate offset
   * Triggers background sync but returns immediately with current time estimate
   * @returns Promise resolving to the current server time estimate
   */
  async initServerTime() {
    this.log.d('initServerTime');
    try {
      const start = Date.now();
      const result = await this.req('GET', 'now');
      const serverTime = toDate(result).getTime();
      const localTime = (start + Date.now()) / 2;
      this.log.d('sync time', localTime, serverTime);
      const offset = serverTime - localTime;
      this.offset$.set(offset);
    } catch (error) {
      this.log.e('initServerTime', error);
    }
  }

  /**
   * Get the current server time estimate
   * Triggers initial sync in background if not yet synced, but returns immediately
   * @returns Current server time in milliseconds (may be inaccurate before first sync completes)
   */
  getTime() {
    return this.offset$.get() + Date.now();
  }

  /**
   * Get the current server time as a Date object
   * @returns Date object representing server time
   */
  getDate() {
    return new Date(this.getTime());
  }

  logout() {
    this.auth$.set(undefined);
  }

  authRefresh(o: PbOptions<any> = {}) {
    const auth = this.getAuth();
    this.log.i('refreshToken', auth, o);
    if (!auth) return;
    return this.req('POST', `collections/${auth.coll}/auth-refresh`, {
      ...o,
    }).then((result: any) => {
      const { status, message, token, record } = result || {};
      if (status === 401) {
        this.logout();
        throw toError(message);
      }
      return this.setAuth({ ...record, coll: auth.coll, token });
    });
  }
}

let pbClient: PbClient;
export const getPbClient = () => pbClient || (pbClient = new PbClient());
