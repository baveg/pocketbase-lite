/**
 * @example
 * a b c d - - - - e - f g - -
 * a - c - d - - - e - f - g - (2s)
 * a - - d - - - - e - - g - - (3s)
 * a - - - d - - - e - - - g - (4s)
 */
export const throttle = <A = unknown>(fn: (value: A) => unknown, ms: number) => {
  let lastTime = 0,
    lastValue: A,
    timer: any;
  const update = () => {
    timer = null;
    fn(lastValue);
    lastTime = Date.now();
  };
  return (value: A) => {
    lastValue = value;
    if (timer) clearTimeout(timer);
    const nextCall = Math.max(ms - (Date.now() - lastTime), 0);
    if (nextCall === 0) update();
    else timer = setTimeout(update, nextCall);
  };
};
