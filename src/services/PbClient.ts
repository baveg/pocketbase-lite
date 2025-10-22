import { req, ReqError, ReqOptions } from '../utils/req';
import { isDictionary, isString } from '../utils/check';
import { observer } from '../utils/observerFun';
import { observerStored } from '../utils/observer/stored';
import { logger } from '../utils/logger';
import { toError } from '../utils/to';
import { PbAuth } from './pbTypes';

export const isPbAuth = (v: PbAuth): v is PbAuth =>
  isDictionary(v) && isString(v.token) && isString(v.id);

export class PbClient {
  log = logger(this.key);
  error$ = observer<ReqError<any> | null>(null);
  auth$ = observerStored<PbAuth>(undefined, { key: this.key + 'Auth', storedCheck: isPbAuth });
  url$ = observerStored<string>('/api/', { key: this.key + 'ApiUrl', storedCheck: isString });

  constructor(public readonly key: string = 'pbClient') {
    this.error$.on((error) => this.log.d('error', error));
    this.auth$.on((auth) => this.log.d('auth', auth));
    this.url$.on((url) => this.log.d('url', url));
  }

  setUrl(url: string) {
    return this.url$.next(url);
  }

  getUrl() {
    return this.url$.get() || '';
  }

  setAuth(auth: PbAuth | undefined) {
    if (auth) {
      if (!isString(auth.token)) throw toError('no auth token');
      if (!isString(auth.id)) throw toError('no auth id');
    }
    this.auth$.next(auth);
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
      onError: this.error$.next,
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
}
