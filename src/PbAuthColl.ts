import { PbColl } from './PbColl';
import { PbModel, PbOptions } from './types';

export class PbAuthColl<T extends PbModel> extends PbColl<T> {
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
        return this.client.setAuth({ ...record, coll: this.name, token });
      })
      .catch((error: any) => {
        this.log.w('login error', error);
        throw error;
      });
  }

  passwordReset(email: string, o: PbOptions<T> = {}) {
    this.log.i('passwordReset', email, o);
    return this.call('POST', `collections/${this.name}/request-password-reset`, {
      data: { email },
      ...o,
    });
  }
}
