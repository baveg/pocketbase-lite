// import { logger } from "./logger";
// import { Listener, observer, Observer, Setter, Subscribe, Unsubscribe } from "./observer";

// export type ObserverMap<T> = Omit<Observer<T>, ''>;

// export const map = <T, U>(
//     source: Observer<T>,
//     convert?: (value: T) => U,
//     reverse?: (value: U) => T,
// ): ObserverMap<U> => {
//     const name = source.key + 'Map';
//     const log = logger(name);
//     const target = observer<U>(name);

//     let sourceOff: Unsubscribe<T>|undefined;
//     let targetOff: Unsubscribe<U>|undefined;

//     const connect = () => {
//         if (!sourceOff && convert) {
//             log.d('connect source');
//             sourceOff = source.on((value) => {
//                 target.next(convert(value));
//             });
//         }
//         if (!targetOff && reverse) {
//             log.d('connect target');
//             targetOff = target.on((value) => {
//                 if (value !== undefined) {
//                     source.next(reverse(value));
//                 }
//             });
//         }
//     }

//     const disconnect = () => {
//         sourceOff && sourceOff();
//         targetOff && targetOff();
//         sourceOff = undefined;
//         targetOff = undefined;
//     }

//     const clear = () => {
//         target.clear();
//         disconnect();
//     }

//     const get: Getter<U> = () => {
//         let value = target.get();
//         if (value === undefined) {
//             target.next()
//         }
//         return value;
//     };
    
//     const on: Subscribe<U> = (listener: (v: U) => void, isRepeat) => {
//         connect();

//         return () => {
//             off();
//             if (!listeners.length) {
//                 clear();
//             }
//         }
//     }

//     return { name, listeners, clear, get, on };
// }