import { pipe } from 'fp-ts/function';

// eslint-disable-next-line no-console
export const log = <A>(...m: Array<unknown>) => (v?: A): void => console.log(...m, ...(v ? [v] : []));

export const pipeAndLog = <A>(p: A, ...m: Array<unknown>): void => pipe(
  p,
  log(...m),
);
