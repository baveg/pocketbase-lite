import { ReqOptions } from 'fluxio/req/types';

export type PbOperator =
  | '=' // Equal
  | '!=' // NOT equal
  | '>' // Greater than
  | '>=' // Greater than or equal
  | '<' // Less than
  | '<=' // Less than or equal
  | '~' // Like/Contains (if not specified auto wraps the right string OPERAND in a "%" for wildcard match)
  | '!~' // NOT Like/Contains (if not specified auto wraps the right string OPERAND in a "%" for wildcard match)
  | '?=' // Any/At least one of Equal
  | '?!=' // Any/At least one of NOT equal
  | '?>' // Any/At least one of Greater than
  | '?>=' // Any/At least one of Greater than or equal
  | '?<' // Any/At least one of Less than
  | '?<=' // Any/At least one of Less than or equal
  | '?~' // Any/At least one of Like/Contains (if not specified auto wraps the right string OPERAND in a "%" for wildcard match)
  | '?!~'; // Any/At least one of NOT Like/Contains (if not specified auto wraps the right string OPERAND in a "%" for wildcard match)

export interface PbModelId {
  id: string;
}

export interface PbModel extends PbModelId {
  created: Date;
  updated: Date;
}

export type PbCreate<T extends PbModel> = Omit<T, 'created' | 'updated' | 'id'>;
export type PbUpdate<T extends PbModel> = Partial<PbCreate<T>>;

export type PbOperand = string | number | null | boolean | Date;
export type PbFilter = PbOperand | [PbOperator, PbOperand];
export type PbWhereItem<T extends PbModel> = { [P in keyof T]?: PbFilter };
export type PbWhere<T extends PbModel> = PbWhereItem<T> | PbWhereItem<T>[];
export type PbKeys<T> = { [K in keyof T]: K extends symbol ? never : K }[keyof T];

export interface PbOptions<T extends PbModel> {
  select?: PbKeys<T>[];
  where?: PbWhere<T>;
  orderBy?: (PbKeys<T> | `-${PbKeys<T>}`)[];
  expand?: string;
  page?: number;
  perPage?: number;
  skipTotal?: boolean;
  data?: any;
  req?: ReqOptions<T>;
}

export interface PbPage<T> {
  items: T[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

export interface PbAuth {
  token: string;
  id: string;
  email?: string;
  verified?: boolean;
  name?: string;
  avatar?: File | Blob | string;
}

export interface PbAuthModel extends PbModel {
  email?: string;
  username?: string;
  oldPassword?: string;
  password?: string;
  passwordConfirm?: string;
  verified?: boolean;
}

// export interface FindOptions<T extends PbModel> {
//   select?: Keys<T>[];
//   where?: { [P in keyof T]?: string | number | Date };
//   orderBy?: (Keys<T> | `-${Keys<T>}`)[];
//   filter?: string;
//   fields?: string;
//   sort?: string;
//   page?: number;
//   perPage?: number;
// }