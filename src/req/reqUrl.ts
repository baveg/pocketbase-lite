import { isBool, isString } from '../check';
import { getLength } from '../getLength';
import { glb } from '../glb';
import { jsonStringify } from '../json';
import { pathJoin } from '../pathJoin';

export const getUrlParams = (url: string): Record<string, string> => {
  let match;
  const pl = /\+/g;
  const search = /([^&=]+)=?([^&]*)/g;
  const decode = (s: string) => decodeURIComponent(s.replace(pl, ' '));
  const queryIndex = url.indexOf('?');
  const query = queryIndex >= 0 ? url.substring(queryIndex + 1) : '';
  const params: Record<string, string> = {};
  while ((match = search.exec(query))) {
    const key = match[1];
    const value = match[2];
    if (key && value) {
      params[decode(key)] = decode(value);
    }
  }
  return params;
};

export const setUrlParams = (url: string, changes?: Record<string, any> | null): string => {
  if (!changes || getLength(changes) === 0) return url;

  const parts = url.split('#');
  const baseUrl = parts[0] || '';
  const hash = parts[1];
  const path = baseUrl.split('?', 1)[0];
  const params = getUrlParams(url);

  for (const key in changes) {
    const value = changes[key];
    if (value === undefined) {
    } else if (value === null) delete params[key];
    else if (isString(value)) params[key] = value;
    else if (isBool(value)) params[key] = value ? '1' : '0';
    else params[key] = jsonStringify(value);
  }

  const pairs: string[] = [];
  for (const key in params) {
    const value = params[key];
    if (value !== undefined) {
      pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    }
  }
  const newQuery = pairs.join('&');

  return path + (newQuery ? '?' + newQuery : '') + (hash ? '#' + hash : '');
};

export const reqUrl = (
  baseUrl?: string | null,
  url?: string | null | URL,
  params?: Record<string, any> | null
) => {
  if (!isString(url)) url = String(url);

  if (!url.match(/^https?:\/\//)) {
    if (!isString(baseUrl)) {
      const location = glb.location || {};
      baseUrl = (location.protocol || 'http:') + '//' + (location.host || '0.0.0.0');
    }
    url = pathJoin(baseUrl, url);
  }

  url = setUrlParams(url, params);

  return url;
};
