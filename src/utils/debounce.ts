/**
 * @example
 * a b c - - - d - - e - -
 * - - - - c - - - d - - e
 */
export const debounce = <A = unknown>(fn: (value: A) => unknown, ms: number) => {
  let timer: any, lastValue: A;
  const update = () => {
    timer = null;
    fn(lastValue);
  };
  return (value: A) => {
    lastValue = value;
    if (timer) clearTimeout(timer);
    timer = setTimeout(update, ms);
  };
};
