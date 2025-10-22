import { Req, ReqContext } from '@common/utils/req';
import { parse } from '@common/utils/json';
import { pathJoin } from '@common/utils/pathJoin';
import { toError } from '@common/utils/cast';
import { TMap } from '@common/utils/types';

const initRealtime = () => {
  let clientId: string = '';
  let eventSource: EventSource | undefined = undefined;
  let reqCtx: ReqContext<any> | undefined = undefined;
  let intervalId: any;
  let lastState = '';
  const subscriptions: TMap<((data: any) => void)[]> = {};
  const realtimeUrl = pathJoin(getApiUrl(), 'realtime');

  let lastHeartbeat = 0;
  let reconnectAttempts = 0;
  let reconnectTimeout: any;
  const wrappedListeners: TMap<(event: any) => void> = {};

  const isConnected = (): boolean =>
    !!eventSource &&
    !!clientId &&
    eventSource.readyState === EventSource.OPEN &&
    Date.now() - lastHeartbeat < 30000;

  const addAllListeners = (eventSource: EventSource) => {
    // console.debug('realtime addAllListeners', eventSource);

    // Remove old listeners first to prevent duplication
    for (const key in wrappedListeners) {
      const listener = wrappedListeners[key];
      if (listener) eventSource.removeEventListener(key, listener);
      delete wrappedListeners[key];
    }

    // Add new listeners
    for (const key in subscriptions) {
      const listeners = subscriptions[key];
      if (listeners && listeners.length > 0) {
        const listener = (wrappedListeners[key] = (event: any) => {
          lastHeartbeat = Date.now();
          listeners.forEach((listener) => listener(event));
        });
        eventSource.addEventListener(key, listener);
      }
    }
  };

  const disconnect = () => {
    console.log('🔌 Realtime disconnect');
    clearTimeout(reconnectTimeout);
    if (reqCtx) {
      reqCtx.abort();
      reqCtx = undefined;
    }
    if (eventSource) {
      // Clean up listeners before closing
      for (const key in wrappedListeners) {
        const listener = wrappedListeners[key];
        if (listener) eventSource.removeEventListener(key, listener);
        delete wrappedListeners[key];
      }
      eventSource.close();
      eventSource = undefined;
    }
    clientId = '';
    lastHeartbeat = 0;
    lastState = '';
  };

  const scheduleReconnect = (req: Req) => {
    clearTimeout(reconnectTimeout);
    reconnectAttempts++;
    const delay = 2000;
    console.log(`⏳ Scheduling reconnect attempt #${reconnectAttempts} in ${delay}ms`);
    reconnectTimeout = setTimeout(() => update(req), delay);
  };

  const connect = async (req: Req) => {
    console.log('🔄 Realtime connecting to', realtimeUrl);
    disconnect();

    return new Promise<void>((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        reject(new Error('Connection timeout after 30s'));
      }, 30000);

      eventSource = new EventSource(realtimeUrl);

      eventSource.addEventListener('PB_CONNECT', (e: MessageEvent) => {
        clearTimeout(connectTimeout);
        if (!e) {
          console.warn('⚠️ PB_CONNECT event is null');
          return reject(new Error('PB_CONNECT event is null'));
        }
        const id = (parse(e.data) || {}).clientId;
        if (!id) {
          console.warn('⚠️ PB_CONNECT missing clientId');
          return reject(new Error('PB_CONNECT missing clientId'));
        }
        clientId = id;
        lastHeartbeat = Date.now();
        reconnectAttempts = 0; // Reset on successful connection
        console.log('✅ Realtime connected, clientId:', clientId);
        resolve();
      });

      eventSource.addEventListener('error', (e: Event) => {
        console.error('❌ EventSource error:', e);
        clearTimeout(connectTimeout);

        if (eventSource?.readyState === EventSource.CLOSED) {
          console.log('🔴 EventSource closed, scheduling reconnect');
          disconnect();
          scheduleReconnect(req);
        } else if (eventSource?.readyState === EventSource.CONNECTING) {
          console.log('🟡 EventSource reconnecting...');
        }
      });

      eventSource.addEventListener('open', () => {
        console.log('🟢 EventSource opened');
      });
    });
  };

  const update = async (req: Req) => {
    try {
      console.log('🔄 Realtime update');
      clearInterval(intervalId);
      intervalId = setInterval(() => update(req), 10000);

      const state = (isConnected() ? 'ok' : 'ko') + Object.keys(subscriptions).join(',');
      if (state === lastState) return;
      lastState = state;

      const subscriptionKeys: string[] = [];
      for (const key in subscriptions) {
        const sub = subscriptions[key];
        if (!sub || !sub.length) {
          delete subscriptions[key];
        } else {
          subscriptionKeys.push(key);
        }
      }
      console.log('📊 Realtime state:', state, 'subscriptions:', subscriptionKeys.length);

      if (!subscriptionKeys.length) return disconnect();
      if (!isConnected()) {
        await connect(req);
      }

      console.log('📤 Sending subscription request for', subscriptionKeys.length, 'topics');
      await req('POST', realtimeUrl, {
        json: {
          clientId,
          subscriptions: subscriptionKeys,
        },
        headers: {
          'content-type': 'application/json',
        },
        before: (ctx) => {
          reqCtx = ctx;
        },
      });

      reqCtx = undefined;
      if (eventSource) {
        addAllListeners(eventSource);
        console.log('✅ Listeners attached successfully');
      }
    } catch (e) {
      const error = toError(e);
      console.error('❌ Realtime update error:', error.message);
      disconnect();
      scheduleReconnect(req);
    }
  };

  return {
    subscriptions,
    update,
  };
};

export const realtime = initRealtime();
