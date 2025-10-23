/**
 * Throttles a function call, ensuring it executes at most once per specified time period.
 * The first call executes immediately, subsequent calls are queued until the cooldown expires.
 *
 * @example Event sequence (ms = 1000):
 * Time:     0  1  2  3  4  5  6  7  8
 * Events:   a  b  c     d     e  f
 * Executes: a     c     d     e     f
 *
 * The first event in each burst executes immediately or after cooldown.
 * Subsequent events within the cooldown period are delayed.
 */
interface Throttle {
  (fn: () => unknown, ms: number): () => void;
  <A>(fn: (value: A) => unknown, ms: number): (value: A) => void;
}
export const throttle = (<A = unknown>(fn: (value?: A) => unknown, ms: number) => {
  let lastTime = 0;
  let lastValue: A | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const update = () => {
    timer = undefined;
    fn(lastValue);
    lastTime = Date.now();
  };
  return (value?: A) => {
    lastValue = value;
    if (timer !== undefined) clearTimeout(timer);
    const nextCall = Math.max(ms - (Date.now() - lastTime), 0);
    if (nextCall === 0) update();
    else timer = setTimeout(update, nextCall);
  };
}) as Throttle;