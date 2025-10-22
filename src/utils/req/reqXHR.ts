import { jsonParse } from '../json';
import { ReqContext } from './reqTypes';

export const reqXHR = async <T = any>(ctx: ReqContext<T>): Promise<void> => {
  try {
    ctx.log.d('reqXHR', ctx);

    const o = ctx.options;
    const xhr: XMLHttpRequest = ctx.xhr || (ctx.xhr = new XMLHttpRequest());

    ctx.abort = () => xhr.abort();

    xhr.timeout = ctx.timeout || 10000;
    const responseType = (xhr.responseType = ctx.resType || 'json');

    if (o.cors) xhr.withCredentials = true;

    xhr.open(ctx.method, ctx.url, true, o.username, o.password);

    if (o.cors) xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

    for (const key in ctx.headers) {
      const val = ctx.headers[key];
      if (val !== undefined) xhr.setRequestHeader(key, val);
    }

    const onProgress = o.onProgress;
    if (onProgress) {
      const _onProgress = (event: ProgressEvent<XMLHttpRequestEventTarget>) => {
        try {
          ctx.event = event;
          onProgress(event.loaded / event.total, ctx);
        } catch (_) {}
      };
      xhr.addEventListener('progress', _onProgress);
      xhr.upload?.addEventListener('progress', _onProgress);
    }

    if (o.before) await o.before(ctx);
    await new Promise<void>((resolve) => {
      const cb = () => {
        let data = xhr.response as any;
        if (responseType === 'text') data = String(data);
        else if (responseType === 'json')
          data = typeof data === 'string' ? jsonParse(data) || data : data;
        ctx.data = data;
        ctx.res = xhr.response;
        ctx.status = xhr.status;
        ctx.headers = {};
        ctx.ok = xhr.status >= 200 && xhr.status < 300;
        resolve();
      };
      xhr.onloadend = xhr.onerror = xhr.ontimeout = xhr.onabort = cb;
      xhr.send(ctx.body);
    });
  } catch (error) {
    ctx.error = error;
    ctx.ok = false;
  }
};
