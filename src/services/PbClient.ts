import { req, ReqError, ReqOptions, isDictionary, isString, flux, fluxStored, logger, toError, toDate, isNumber } from 'fluxio';
import { PbAuth } from './pbTypes';

export const isPbAuth = (v: any): v is PbAuth =>
  isDictionary(v) && isString(v.token) && isString(v.id);

export class PbClient {
  log = logger(this.key);
  error$ = flux<ReqError<any> | null>(null);
  auth$ = fluxStored<PbAuth|undefined>(this.key + 'Auth', undefined, isPbAuth);
  url$ = fluxStored<string>(this.key + 'ApiUrl', '/api/', isString);
  timeOffset$ = fluxStored<number>(this.key + 'TimeOffset', 0, isNumber);
  
  constructor(public readonly key: string = 'pbClient') {
    this.error$.on((error) => this.log.d('error', error));
    this.auth$.on((auth) => this.log.d('auth', auth));
    this.url$.on((url) => this.log.d('url', url));
    this.serverTime();
  }

  setUrl(url: string) {
    return this.url$.set(url);
  }

  getUrl() {
    return this.url$.get() || '';
  }

  setAuth(auth: PbAuth | undefined) {
    if (auth) {
      if (!isString(auth.token)) throw toError('no auth token');
      if (!isString(auth.id)) throw toError('no auth id');
    }
    this.auth$.set(auth);
    return auth;
  }

  getAuth() {
    return this.auth$.get();
  }

  getToken() {
    return this.getAuth()?.token || '';
  }

  reqOptions(options: ReqOptions = {}): ReqOptions {
    const baseUrl = this.getUrl();
    const token = this.getToken();
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'X-Auth-Token': token,
    };
    return {
      baseUrl,
      timeout: 10000,
      onError: this.error$.setter(),
      ...options,
      headers: {
        ...authHeaders,
        ...options.headers,
      },
    };
  }

  req(options: ReqOptions = {}) {
    return req(this.reqOptions(options)).catch((error) => {
      this.log.w('req error', error);
      throw error;
    });
  }

  getTime() {
    return ;
  }

  async syncServerTime() {
    try {
      const start = Date.now();
      const result = await this.req({ url: 'now' });
      const serverTime = toDate(result).getTime();
      const localTime = (start + Date.now()) / 2;
      this.log.d('sync time', localTime, serverTime);
      const timeOffset = serverTime - localTime;
      this.timeOffset$.set(timeOffset);
    }
    catch (error) {
      this.log.e('syncServerTime', error);
    }
    return this.serverTime();
  }

  serverTime() {
    const timeOffset = this.timeOffset$.get();
    if (timeOffset === 0) {
      // sync but retourne value not sync
      this.syncServerTime();
    }
    return timeOffset + Date.now();
  }

  serverDate() {
    return new Date(this.serverTime());
  }
}
