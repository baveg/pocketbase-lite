import { jsonParse } from '../json';
import { ReqContext } from './reqTypes';

export const reqFetch = async <T = any>(ctx: ReqContext<T>): Promise<void> => {
  try {
    ctx.log.d('reqFetch', ctx);

    const o = ctx.options;

    const fetchRequest: RequestInit = (ctx.fetchInit = {
      body: ctx.body as any,
      headers: ctx.headers as any,
      method: ctx.method,
    });

    const abortCtrl = new AbortController();
    fetchRequest.signal = abortCtrl.signal;
    ctx.abort = () => abortCtrl.abort();

    if (ctx.timeout) {
      setTimeout(() => abortCtrl.abort(), ctx.timeout);
    }

    if (o.before) await o.before(ctx);

    const response = await (typeof o.fetch === 'function' ? o.fetch : fetch)(
      ctx.url as any,
      fetchRequest
    );
    ctx.res = response;
    ctx.status = response.status;
    ctx.ok = response.ok;

    if (o.cast) {
      ctx.data = await o.cast(ctx);
      return;
    } else {
      switch (ctx.resType) {
        case 'blob':
          ctx.data = (await response.blob()) as T;
          break;
        case 'json': {
          // Handle 204 No Content responses that have no body to parse
          if (response.status === 204) {
            ctx.data = null as T;
          } else {
            const obj: any = (await response.json()) as any;
            ctx.data = typeof obj === 'string' ? jsonParse(obj) || obj : obj;
          }
          break;
        }
        case 'text':
          ctx.data = (await response.text()) as T;
          break;
        case 'arraybuffer':
          ctx.data = (await response.arrayBuffer()) as T;
          break;
      }
    }
  } catch (error) {
    ctx.error = error;
    ctx.ok = false;
  }
};
