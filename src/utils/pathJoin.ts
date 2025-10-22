export const pathJoin = (...args: string[]): string =>
  args
    .map((a, i) =>
      a.substring(
        a[0] === '/' && i !== 0 ? 1 : 0,
        a[a.length - 1] === '/' && i !== args.length - 1 ? a.length - 1 : a.length
      )
    )
    .join('/');
