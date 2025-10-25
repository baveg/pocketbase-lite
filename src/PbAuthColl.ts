import { toError } from 'fluxio/cast/toError';
import { PbColl } from './PbColl';
import { PbModelBase, PbOptions } from './types';

export class PbAuthColl<T extends PbModelBase> extends PbColl<T> {
  signUp(email: string, password: string, o: PbOptions<T> = {}) {
    this.log.i('signUp', email, password, o);
    return this.create({ email, password, passwordConfirm: password } as any, o);
  }

  login(identity: string, password: string, o: PbOptions<T> = {}) {
    this.log.i('login', identity, o);
    return this.call('POST', `collections/${this.name}/auth-with-password`, {
      data: { identity, password },
      ...o,
    })
      .then((result: any) => {
        const { token, record } = result || {};
        return this.client.setAuth({ ...record, token });
      })
      .catch((error: any) => {
        this.log.w('login error', error);
        throw error;
      });
  }

  logout() {
    this.log.i('logout');
    this.client.setAuth(undefined);
  }

  passwordReset(email: string, o: PbOptions<T> = {}) {
    this.log.i('passwordReset', email, o);
    return this.call('POST', `collections/${this.name}/request-password-reset`, {
      data: { email },
      ...o,
    });
  }

  refreshToken(o: PbOptions<T> = {}) {
    this.log.i('refreshToken', o);
    return this.call('POST', `collections/${this.name}/auth-refresh`, {
      ...o,
    }).then((result: any) => {
      const { status, message, token, record } = result || {};
      if (status === 401) {
        this.logout();
        throw toError(message);
      }
      return this.client.setAuth({ ...record, token });
    });
  }
}
