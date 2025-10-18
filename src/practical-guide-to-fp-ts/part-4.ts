import * as A from 'fp-ts/Array';
import * as E from 'fp-ts/Either';
import * as M from 'fp-ts/Monoid';
import * as NEA from 'fp-ts/NonEmptyArray';
import { Semigroup } from 'fp-ts/Semigroup';
import { pipe } from 'fp-ts/function';
import * as N from 'fp-ts/number';
import { pipeAndLog } from '../utils/log';

{
  const foo = [1, 2, 3];

  let sum = 0;
  for (let i = 0; i < foo.length; i += 1) {
    sum += foo[i];
  }
  pipeAndLog(sum, 1.1); // 6
}

{
  const foo = [1, 2, 3];

  let sum = 0;
  for (const x of foo) {
    sum += x;
  }
  pipeAndLog(sum, 1.2); // 6
}

{
  const foo = [1, 2, 3, 4, 5];

  const sum = foo
    .map((x) => x - 1)
    .filter((x) => x % 2 === 0)
    .reduce((prev, next) => prev + next, 0);
  pipeAndLog(sum, 1.3); // 6
}

{
  const foo = [1, 2, 3, 4, 5, 6];

  const sum = pipe(
    A.Functor.map((foo), (x) => x - 1),
    A.filter((x) => x % 2 === 0),
    A.reduce(0, (prev, next) => prev + next),
  );

  pipeAndLog(sum, 1.4); // 6
}

{
  const foo = [1, 2, 3];
  const bar = ['a', 'b', 'c'];

  const zipped = pipe(
    foo,
    A.zip(bar),
  );

  pipeAndLog(zipped, 2); // [[1, 'a], [2, 'b], [3, 'c']]
}

{
  const foo = [1, 2, 3];

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const x: number = foo[4]; // no compile error
  foo[5] = 2; // no runtime error
  pipeAndLog(foo, 3); // [1, 2, 3, undefined, undefined, 2]
}

pipeAndLog(pipe(
  [1, 2, 3],
  A.lookup(1),
), 4.1); // { _tag: 'Some', value: 2 }

pipeAndLog(pipe(
  [1, 2, 3],
  A.lookup(3),
), 4.2); // { _tag: 'None' }

{
  const foo = [1, 2, 3];
  if (foo.length > 0) {
    const firstElement = A.head(foo);
    pipeAndLog(firstElement, 5); // { _tag: 'Some', value: 1 }
  }
}

{
  const foo = [1, 2, 3];
  if (A.isNonEmpty(foo)) {
    const firstElement = NEA.head(foo);
    pipeAndLog(firstElement, 6); // 1
  }
}

type Foo = {
  readonly _tag: 'Foo',
  readonly f: () => number,
};

type Bar = {
  readonly _tag: 'Bar',
  readonly g: () => number,
};

{
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const compute = (arr: Array<Foo | Bar>) => {
    let sum = 0;
    let max = Number.NEGATIVE_INFINITY;

    arr.forEach((a) => {
      switch (a._tag) {
        case 'Foo':
          sum += a.f();
          break;
        case 'Bar':
          max = Math.max(max, a.g());
          break;
      }
    });

    return sum * max;
  };
}

{
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const compute = (arr: Array<Foo | Bar>) => pipe(
    arr,
    A.partitionMap((a) => (a._tag === 'Foo' ? E.left(a) : E.right(a))),
    ({ left: foos, right: bars }) => {
      const sum = pipe(foos, A.reduce(0, (prev, foo) => prev + foo.f()));
      const max = pipe(bars, A.reduce(Number.NEGATIVE_INFINITY, (m, bar) => Math.max(m, bar.g())));

      return sum * max;
    },
  );
}

const semigroupMax: Semigroup<number> = {
  concat: Math.max,
};

const monoidMax: M.Monoid<number> = {
  concat: semigroupMax.concat,
  empty: Number.NEGATIVE_INFINITY,
};

{
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const compute = (arr: Array<Foo | Bar>) => pipe(
    arr,
    A.partitionMap((a) => (a._tag === 'Foo' ? E.left(a) : E.right(a))),
    ({ left: foos, right: bars }) => {
      const sum = pipe(foos, A.foldMap(N.MonoidSum)((foo) => foo.f()));
      const max = pipe(bars, A.foldMap(monoidMax)((bar) => bar.g()));

      return sum * max;
    },
  );
}

const compute = (fooMonoid: M.Monoid<number>, barMonoid: M.Monoid<number>) => (arr: Array<Foo | Bar>) => pipe(
  arr,
  A.partitionMap((a) => (a._tag === 'Foo' ? E.left(a) : E.right(a))),
  ({ left: foos, right: bars }) => {
    const sum = pipe(foos, A.foldMap(fooMonoid)((foo) => foo.f()));
    const max = pipe(bars, A.foldMap(barMonoid)((bar) => bar.g()));

    return sum * max;
  },
);

// Example: Using compute with different Monoid strategies
const testData: Array<Foo | Bar> = [
  { _tag: 'Foo', f: () => 10 },
  { _tag: 'Foo', f: () => 20 },
  { _tag: 'Bar', g: () => 5 },
  { _tag: 'Bar', g: () => 15 },
];

// Sum Foo values, find max Bar value: (10 + 20) * max(5, 15) = 30 * 15 = 450
pipeAndLog(compute(N.MonoidSum, monoidMax)(testData), 7.1);

// Find max Foo value, sum Bar values: max(10, 20) * (5 + 15) = 20 * 20 = 400
pipeAndLog(compute(monoidMax, N.MonoidSum)(testData), 7.2);
