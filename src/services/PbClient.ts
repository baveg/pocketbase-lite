import {
  req,
  ReqError,
  ReqOptions,
  isDictionary,
  isString,
  flux,
  fluxStored,
  logger,
  toError,
  toDate,
  isNumber,
} from 'fluxio';
import { PbAuth } from './pbTypes';

export const isPbAuth = (v: any): v is PbAuth =>
  isDictionary(v) && isString(v.token) && isString(v.id);

export class PbClient {
  log = logger(this.key);
  error$ = flux<ReqError<any> | null>(null);
  auth$ = fluxStored<PbAuth | undefined>(this.key + 'Auth', undefined, isPbAuth);
  url$ = fluxStored<string>(this.key + 'ApiUrl', '/api/', isString);
  timeOffset$ = fluxStored<number>(this.key + 'TimeOffset', 0, isNumber);

  constructor(public readonly key: string = 'pbClient') {
    this.error$.on((error) => this.log.d('error', error));
    this.auth$.on((auth) => this.log.d('auth', auth));
    this.url$.on((url) => this.log.d('url', url));
    this.serverTime();
  }

  /**
   * Set the API base URL
   * @param url The base URL for API requests
   */
  setUrl(url: string) {
    return this.url$.set(url);
  }

  /**
   * Get the current API base URL
   * @returns The base URL string
   */
  getUrl() {
    return this.url$.get() || '';
  }

  /**
   * Set the authentication token and user info
   * @param auth Authentication object with token and id, or undefined to clear
   * @returns The auth object that was set
   */
  setAuth(auth: PbAuth | undefined) {
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

  /**
   * Get the current authentication token
   * @returns The token string or empty string if not authenticated
   */
  getToken() {
    return this.getAuth()?.token || '';
  }

  /**
   * Build request options with authentication headers and base URL
   * @param options Partial request options to merge
   * @returns Complete request options with auth headers
   */
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

  /**
   * Make an HTTP request with authentication
   * @param options Request options
   * @returns Promise resolving to the response data
   */
  req(options: ReqOptions = {}) {
    return req(this.reqOptions(options)).catch((error) => {
      this.log.w('req error', error);
      throw error;
    });
  }

  /**
   * Synchronize server time with local time and calculate offset
   * Triggers background sync but returns immediately with current time estimate
   * @returns Promise resolving to the current server time estimate
   */
  async syncServerTime() {
    try {
      const start = Date.now();
      const result = await this.req({ url: 'now' });
      const serverTime = toDate(result).getTime();
      const localTime = (start + Date.now()) / 2;
      this.log.d('sync time', localTime, serverTime);
      const timeOffset = serverTime - localTime;
      this.timeOffset$.set(timeOffset);
    } catch (error) {
      this.log.e('syncServerTime', error);
    }
    return this.serverTime();
  }

  /**
   * Get the current server time estimate
   * Triggers initial sync in background if not yet synced, but returns immediately
   * @returns Current server time in milliseconds (may be inaccurate before first sync completes)
   */
  serverTime() {
    const timeOffset = this.timeOffset$.get();
    if (timeOffset === 0) {
      // Trigger async sync but return current estimate immediately (not yet synchronized)
      this.syncServerTime();
    }
    return timeOffset + Date.now();
  }

  /**
   * Get the current server time as a Date object
   * @returns Date object representing server time
   */
  serverDate() {
    return new Date(this.serverTime());
  }
}
