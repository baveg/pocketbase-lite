export const isDefined = <T>(v: T | null | undefined): v is NonNullable<T> | null =>
  v !== undefined;