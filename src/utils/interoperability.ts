import * as E from 'fp-ts/Either';
import type * as IO from 'fp-ts/IO';
import * as O from 'fp-ts/Option';
import type * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';

export const findIndex = <A>(as: Array<A>, predicate: (a: A) => boolean): O.Option<number> => {
  const index = as.findIndex(predicate);
  return index === -1 ? O.none : O.some(index);
};

export const find = <A>(as: Array<A>, predicate: (a: A) => boolean): O.Option<A> => O.fromNullable(as.find(predicate));

export const parse = (s: string): E.Either<Error, unknown> => E.tryCatch(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  () => JSON.parse(s),
  (reason) => new Error(String(reason)),
);

export const random: IO.IO<number> = () => Math.random();

export const wait: T.Task<void> = async () => new Promise<void>((resolve) => {
  setTimeout(resolve, 1000);
});

export const get = (url: string): TE.TaskEither<Error, string> => TE.tryCatch(
  async () => pipe(
    await pipe(
      url,
      fetch,
    ),
    async (res) => res.text(),
  ),
  (reason) => new Error(String(reason)),
);
