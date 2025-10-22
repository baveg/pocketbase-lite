import { Msg } from '@common/utils/Msg';
import { apiGet } from './call';
import { toDate } from '@common/utils/cast';

export const getServerTime = () => apiGet('now').then((d) => toDate(d).getTime());

export const serverTimeOffset$ = new Msg(0, 'serverTimeOffset', true);

export const serverTime = () => {
  initServerTime();
  return serverTimeOffset$.v + Date.now();
};

export const serverDate = () => new Date(serverTime());

export const serverDateIso = () => serverDate().toISOString();

export const syncServerTime = () => {
  const start = Date.now();
  getServerTime().then((serverTime) => {
    const localTime = (start + Date.now()) / 2;
    console.debug('sync time', localTime, serverTime);
    const timeOffset = serverTime - localTime;
    serverTimeOffset$.set(serverTime - localTime);
    return timeOffset;
  });
};

let _isInit = false;
export const initServerTime = () => {
  if (!_isInit) {
    _isInit = true;
    syncServerTime();
  }
};
