/* eslint-disable no-console */
import { pipe } from 'fp-ts/function';

export const toError = (reason: unknown): Error => new Error(reason instanceof Error ? reason.message : String(reason));

export const log = <A>(...m: Array<unknown>) => (v?: A): void => console.log(...m, ...(v ? [v] : []));

export const logError = <E>(prefix: string) => (reason: E): E => {
  pipe(
    reason,
    toError,
    (error) => console.error(`${prefix}:`, error),
  );

  return reason;
};

export const pipeAndLog = <A>(p: A, ...m: Array<unknown>): void => pipe(
  p,
  log(...m),
);
