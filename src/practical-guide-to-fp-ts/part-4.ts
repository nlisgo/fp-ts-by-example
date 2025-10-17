import * as A from 'fp-ts/Array';
import { pipe } from 'fp-ts/function';
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

  pipeAndLog(zipped, 2);
}
