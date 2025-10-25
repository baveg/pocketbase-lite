import { Dictionary } from 'fluxio/check/isDictionary';
import { PbClient } from './PbClient';
import { PbModelBase, PbOptions } from './types';
import { logger } from 'fluxio/logger/Logger';
import { ReqContext } from 'fluxio/req/types';
import { jsonParse, jsonStringify } from 'fluxio/string/json';
import { removeItem } from 'fluxio/array/removeItem';

export class PbRealtime {
  public readonly subscriptions: Dictionary<((data: any) => void)[]> = {};
  public readonly wrappedListeners: Dictionary<(event: any) => void> = {};

  public url = 'realtime';
  public log = logger('PbRealtime');
  public id = '';
  public source?: EventSource;
  public reqCtx?: ReqContext<any>;
  public intervalId?: ReturnType<typeof setInterval>;
  public timeoutId?: ReturnType<typeof setTimeout>;
  public state = '';
  public heartbeat = 0;
  public attempts = 0;

  constructor(public readonly client: PbClient) {}

  on<T extends PbModelBase>(
    collName: string,
    cb: (item: T, action: 'update' | 'create' | 'delete') => void,
    topic: string = '*',
    o: PbOptions<T> = {}
  ) {
    this.log.d('on', collName, topic, o);
    // 'devices/8e2mu4rr32b0glf?options={"headers": {"x-token": "..."}}'

    const p = this.client.getReqOptions('GET', this.url, o);
    const keyOptions =
      p.params || p.headers ?
        `?options=${encodeURIComponent(jsonStringify({ query: p.params, headers: p.headers }))}`
      : '';
    const key = `${collName}/${topic}${keyOptions}`;

    this.log.d('subscribe key', collName, key);

    const listener = (event: MessageEvent) => {
      this.log.d('subscribe listener', collName, key, event);
      const payload = jsonParse(event.data);
      const record = (payload ? payload.record : null) || payload;
      const id = (record ? record.id : null) || record;
      this.log.d('subscribe listener payload', collName, key, id);
      cb(record, payload.action);
    };

    const subscriptions = this.subscriptions;
    const listeners = subscriptions[key] || (subscriptions[key] = []);
    listeners.push(listener);

    this.update();

    return () => {
      const listeners = subscriptions[key] || subscriptions[key] || [];
      removeItem(listeners, listener);
      this.update();
    };
  }

  getIsConnected() {
    return (
      !!this.source &&
      !!this.id &&
      this.source.readyState === EventSource.OPEN &&
      Date.now() - this.heartbeat < 30000
    );
  }

  addAllListeners(eventSource: EventSource) {
    this.log.d('addAllListeners', eventSource);

    // Remove old listeners first to prevent duplication
    for (const key in this.wrappedListeners) {
      const listener = this.wrappedListeners[key];
      if (listener) eventSource.removeEventListener(key, listener);
      delete this.wrappedListeners[key];
    }

    // Add new listeners
    for (const key in this.subscriptions) {
      const listeners = this.subscriptions[key];
      if (listeners && listeners.length > 0) {
        const listener = (this.wrappedListeners[key] = (event: any) => {
          this.heartbeat = Date.now();
          listeners.forEach((listener) => listener(event));
        });
        eventSource.addEventListener(key, listener);
      }
    }
  }

  disconnect() {
    this.log.d('disconnect');
    clearTimeout(this.timeoutId);
    if (this.reqCtx) {
      this.reqCtx.abort();
      this.reqCtx = undefined;
    }
    if (this.source) {
      // Clean up listeners before closing
      for (const key in this.wrappedListeners) {
        const listener = this.wrappedListeners[key];
        if (listener) this.source.removeEventListener(key, listener);
        delete this.wrappedListeners[key];
      }
      this.source.close();
      this.source = undefined;
    }
    this.id = '';
    this.heartbeat = 0;
    this.state = '';
  }

  scheduleReconnect() {
    clearTimeout(this.timeoutId);
    this.attempts++;
    const delay = 2000;
    this.log.d('scheduleReconnect', this.attempts, delay);
    this.timeoutId = setTimeout(() => this.update(), delay);
  }

  async connect() {
    this.log.d('connect');
    this.disconnect();

    return new Promise<void>((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        reject(new Error('Connection timeout after 30s'));
      }, 30000);

      this.source = new EventSource(this.client.getUrl(this.url));

      this.source.addEventListener('PB_CONNECT', (e: MessageEvent) => {
        clearTimeout(connectTimeout);
        if (!e) {
          this.log.w('event is null');
          return reject(new Error('PB_CONNECT event is null'));
        }
        const id = (jsonParse(e.data) || {}).clientId;
        if (!id) {
          this.log.w('missing clientId');
          return reject(new Error('PB_CONNECT missing clientId'));
        }
        this.id = id;
        this.heartbeat = Date.now();
        this.attempts = 0; // Reset on successful connection
        this.log.d('connected', this.id);
        resolve();
      });

      this.source.addEventListener('error', (e: Event) => {
        this.log.e('onError', e);
        clearTimeout(connectTimeout);

        if (this.source?.readyState === EventSource.CLOSED) {
          this.log.d('reconnect');
          this.disconnect();
          this.scheduleReconnect();
        } else if (this.source?.readyState === EventSource.CONNECTING) {
          this.log.d('reconnecting');
        }
      });

      this.source.addEventListener('open', () => {
        console.log('🟢 EventSource opened');
      });
    });
  }

  async update() {
    try {
      this.log.d('update');
      clearInterval(this.intervalId);
      this.intervalId = setInterval(() => this.update(), 10000);

      const state =
        (this.getIsConnected() ? 'ok' : 'ko') + Object.keys(this.subscriptions).join(',');
      if (state === this.state) {
        return;
      }
      this.state = state;

      const subscriptionKeys: string[] = [];
      for (const key in this.subscriptions) {
        const sub = this.subscriptions[key];
        if (!sub || !sub.length) {
          delete this.subscriptions[key];
        } else {
          subscriptionKeys.push(key);
        }
      }
      this.log.d('state', state, 'count', subscriptionKeys.length);

      if (!subscriptionKeys.length) {
        return this.disconnect();
      }
      if (!this.getIsConnected()) {
        await this.connect();
      }

      this.log.d('sending subscription', subscriptionKeys);
      await this.client.req('POST', this.url, {
        req: {
          json: {
            clientId: this.id,
            subscriptions: subscriptionKeys,
          },
          headers: {
            'content-type': 'application/json',
          },
          before: (ctx) => {
            this.reqCtx = ctx;
          },
        },
      });

      this.reqCtx = undefined;
      if (this.source) {
        this.addAllListeners(this.source);
        this.log.i('successfully');
      }
    } catch (error) {
      this.log.e('update', error);
      this.disconnect();
      this.scheduleReconnect();
    }
  }
}
