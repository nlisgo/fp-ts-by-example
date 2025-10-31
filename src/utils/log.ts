/* eslint-disable no-console */
import { pipe } from 'fp-ts/function';

export const log = <A>(...m: Array<unknown>) => (v?: A): void => console.log(...m, ...(v ? [v] : []));

export const logError = (prefix: string) => (error: Error): Error => {
  console.error(`${prefix}:`, error);
  return error;
};

export const pipeAndLog = <A>(p: A, ...m: Array<unknown>): void => pipe(
  p,
  log(...m),
);
