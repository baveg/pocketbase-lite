/**
 * Debounces a function call, delaying execution until after a specified time has passed
 * since the last invocation.
 *
 * @example Event sequence (ms = 1000):
 * Time:     0  1  2  3  4  5  6  7  8  9
 * Events:   a  b  c     d        e  f   
 * Executes:          c     d           f
 *
 * Each event cancels the previous timer and starts a new one.
 * Only the last event in a burst gets executed.
 */
interface Debounce {
  (fn: () => unknown, ms: number): () => void;
  <A>(fn: (value: A) => unknown, ms: number): (value: A) => void;
}
export const debounce = (<A>(fn: (value?: A) => unknown, ms: number) => {
  let timer: ReturnType<typeof setTimeout>|undefined;
  let lastValue: A | undefined;
  const update = () => {
    timer = undefined;
    fn(lastValue);
  };
  return (value?: A) => {
    lastValue = value;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(update, ms);
  };
}) as Debounce;
