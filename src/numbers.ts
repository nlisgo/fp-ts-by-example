import {
  concatAll, min, max, struct,
} from 'fp-ts/Monoid';
import * as B from 'fp-ts/boolean';
import { getMonoid, pipe } from 'fp-ts/function';
import * as N from 'fp-ts/number';
import { pipeAndLog } from './utils/log';

const minVal = pipe(
  N.Bounded,
  min,
  concatAll,
);
const maxVal = pipe(
  N.Bounded,
  max,
  concatAll,
);

pipeAndLog(
  pipe(
    [5, 2, 3],
    minVal,
  ),
  1.1,
); // 2
pipeAndLog(
  pipe(
    [5, 2, 3],
    maxVal,
  ),
  1.2,
); // 5

const sum = pipe(
  N.MonoidSum,
  concatAll,
);
const product = pipe(
  N.MonoidProduct,
  concatAll,
);

pipeAndLog(
  pipe(
    [1, 2, 3, 4],
    sum,
  ),
  2.1,
); // 10
pipeAndLog(
  pipe(
    [1, 2, 3, 4],
    product,
  ),
  2.2,
); // 24

const monoidPoint = struct({
  x: N.MonoidSum,
  y: N.MonoidSum,
});

const monoidPoints = pipe(
  monoidPoint,
  concatAll,
);

pipeAndLog(monoidPoint.concat({ x: 0, y: 3 }, { x: 2, y: 4 }), 3.1); // { x: 2, y: 7 }
pipeAndLog(monoidPoints([
  { x: 2, y: 2 },
  { x: 2, y: 2 },
  { x: 2, y: 2 },
]), 3.2); // { x: 6, y: 6 }

type Point = {
  x: number,
  y: number,
};

const monoidPredicate = getMonoid(B.MonoidAll)<Point>();

const isPositiveX = (p: Point) => p.x >= 0;
const isPositiveY = (p: Point) => p.y >= 0;

const isPositiveXY = monoidPredicate.concat(isPositiveX, isPositiveY);

pipeAndLog(isPositiveXY({ x: 1, y: 1 }), 4.1); // true
pipeAndLog(isPositiveXY({ x: 1, y: -1 }), 4.2); // false
pipeAndLog(isPositiveXY({ x: -1, y: 1 }), 4.3); // false
pipeAndLog(isPositiveXY({ x: -1, y: -1 }), 4.4); // false
