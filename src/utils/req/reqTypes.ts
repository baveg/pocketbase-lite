import type { Logger } from "../logger";
import type { ReqError } from "./reqError";

export type FormDataObject = { [prop: string]: any };
export type ReqURL = string | URL;
export type ReqMethod = 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT';
export type ReqData = any;
export type ReqParams = Record<string, any>;
export type ReqHeaders = Record<string, string>;
export type ReqBody = Document | XMLHttpRequestBodyInit | File | null | undefined;
export type ReqResponseType = '' | 'arraybuffer' | 'blob' | 'document' | 'json' | 'text';

export interface ReqOptions<T = any> {
  url?: ReqURL;
  method?: ReqMethod | null;
  headers?: ReqHeaders;
  baseUrl?: string | null;
  timeout?: number | null;
  params?: ReqParams | null;
  body?: ReqBody | null;
  json?: ReqData;
  form?: FormDataObject | FormData | null;
  resType?: ReqResponseType | null;
  noCache?: boolean | null;
  xhr?: boolean | XMLHttpRequest | null;
  fetch?: boolean | ((input: URL, init?: RequestInit) => Promise<Response>) | null;
  base?: (options: ReqOptions<T>) => void | Promise<void> | null;
  before?: (ctx: ReqContext<T>) => void | Promise<void> | null;
  after?: (ctx: ReqContext<T>) => void | Promise<void> | null;
  cast?: (ctx: ReqContext<T>) => T | Promise<T> | null;
  onError?: (error: ReqError<T>) => void;
  onProgress?: (progress: number, ctx: ReqContext<T>) => void | null;
  request?: <T>(ctx: ReqContext<T>) => Promise<T> | null;
  cors?: boolean | null;
  password?: string | null;
  username?: string | null;
  retry?: number;
  log?: Logger;
}

export interface ReqContext<T = any> {
  options: ReqOptions<T>;
  url: string;
  method: ReqMethod;
  resType: ReqResponseType;
  params: ReqParams;
  headers: ReqHeaders;
  body: ReqBody;
  timeout?: number;
  event?: any;
  status?: number;
  ok: boolean;
  data?: T | null;
  error?: any;
  xhr?: XMLHttpRequest;
  res?: Response;
  fetchInit?: RequestInit;
  abort: () => void;
  log: Logger;
}
