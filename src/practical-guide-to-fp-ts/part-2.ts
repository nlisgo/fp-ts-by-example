import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import { pipeAndLog } from '../utils/log';

{
  const foo = {
    bar: 'hello',
  };

  pipeAndLog(
    pipe(
      foo,
      (f) => f.bar,
    ),
    1,
  ); // hello
}

{
  type Foo = {
    bar: string,
  };

  const foo = {
    bar: 'hello',
  } as Foo | undefined;

  pipeAndLog(
    pipe(
      foo,
      (f) => f?.bar,
    ),
    2,
  ); // hello

  pipeAndLog(
    pipe(
      foo,
      O.fromNullable,
    ),
    3.1,
  ); // { _tag: 'Some', value: 'hello' }

  pipeAndLog(
    pipe(
      undefined,
      O.fromNullable,
    ),
    3.2,
  ); // { _tag: 'None' }
}

{
  type Fizz = {
    buzz: string,
  };

  type Foo = {
    bar?: Fizz,
  };

  const foo = { bar: undefined } as Foo | undefined;

  pipeAndLog(
    pipe(
      foo,
      (f) => f?.bar?.buzz,
    ),
    4.1,
  ); // undefined
  pipeAndLog(
    pipe(
      foo,
      O.fromNullable,
      O.map(({ bar }) => pipe(
        bar,
        O.fromNullable,
      )),
    ),
    4.2,
  ); // { _tag: 'Some', value: { _tag: 'None' } }
}
