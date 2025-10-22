import { toError } from "../to";
import type { ReqContext } from "./reqTypes";

export class ReqError<T = any> extends Error {
  status: number;
  res?: Response;
  data?: T | null;
  constructor(
    public error: Error,
    public ctx: Partial<ReqContext<T>>
  ) {
    super(error.message);
    this.status = ctx.status || 0;
    this.res = ctx.res;
    this.data = ctx.data ?? null;
  }
}

export const reqError = <T = any>(e: any, ctx: ReqContext<T>) =>
  e instanceof ReqError ? e : new ReqError<T>(toError(e), ctx);
