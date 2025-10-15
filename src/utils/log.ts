import { pipe } from 'fp-ts/function';

// eslint-disable-next-line no-console
export const log = <A, B>(m: A) => (v: B): void => console.log(m, v);

export const pipeAndLog = <A, B>(p: A, m: B): void => pipe(
  p,
  log(m),
);
