import * as D from 'fp-ts/Date';
import * as E from 'fp-ts/Either';
import * as Eq from 'fp-ts/Eq';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as B from 'fp-ts/boolean';
import * as N from 'fp-ts/number';
import * as S from 'fp-ts/string';
import { pipeAndLog } from './utils/log';

pipeAndLog(B.Eq.equals(false, true), '1.1.1'); // false
pipeAndLog(B.Eq.equals(true, true), '1.1.2'); // true
pipeAndLog(D.Eq.equals(new Date('1984-01-27'), new Date('1984-01-28')), '1.2.1'); // false
pipeAndLog(D.Eq.equals(new Date('1984-01-27'), new Date('1984-01-27')), '1.2.2'); // true
pipeAndLog(N.Eq.equals(2, 3), '1.3.1'); // false
pipeAndLog(N.Eq.equals(3, 3), '1.3.2'); // true
pipeAndLog(S.Eq.equals('Cindi', 'Cyndi'), '1.4.1'); // false
pipeAndLog(S.Eq.equals('Cyndi', 'Cyndi'), '1.4.2'); // true

type Point = {
  x: number,
  y: number,
};

const eqPoint: Eq.Eq<Point> = Eq.struct({
  x: N.Eq,
  y: N.Eq,
});

pipeAndLog(eqPoint.equals({ x: 0, y: 1 }, { x: 0, y: 0 }), 2.1); // false
pipeAndLog(eqPoint.equals({ x: 0, y: 0 }, { x: 0, y: 0 }), 2.2); // true

type Vector = {
  from: Point,
  to: Point,
};

const eqVector: Eq.Eq<Vector> = Eq.struct({
  from: eqPoint,
  to: eqPoint,
});

pipeAndLog(
  eqVector.equals(
    { from: { x: 0, y: 1 }, to: { x: 0, y: 0 } },
    { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } },
  ),
  3.1,
); // false
pipeAndLog(
  eqVector.equals(
    { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } },
    { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } },
  ),
  3.2,
); // true

const eqArrayOfStrings = RA.getEq(S.Eq);

pipeAndLog(
  eqArrayOfStrings.equals(['Timex', 'After', 'Time'], ['Time', 'After', 'Time']),
  4.1,
); // false
pipeAndLog(
  eqArrayOfStrings.equals(['Time', 'After', 'Time'], ['Time', 'After', 'Time']),
  4.2,
); // true

const eqArrayOfPoints = RA.getEq(eqPoint);

pipeAndLog(
  eqArrayOfPoints.equals(
    [
      { x: 0, y: 0 },
      { x: 4, y: 1 },
    ],
    [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ],
  ),
  5.1,
); // false
pipeAndLog(
  eqArrayOfPoints.equals(
    [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ],
    [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ],
  ),
  5.2,
); // true

type User = {
  userId: number,
  name: string,
};

const eqUserId = Eq.contramap((user: User) => user.userId)(N.Eq);

pipeAndLog(
  eqUserId.equals({ userId: 1, name: 'Giulio' }, { userId: 1, name: 'Giulio Canti' }),
  6.1,
); // true
pipeAndLog(
  eqUserId.equals({ userId: 1, name: 'Giulio' }, { userId: 2, name: 'Giulio' }),
  6.2,
); // false

const E7 = O.getEq(N.Eq);

pipeAndLog(
  E7.equals(O.some(3), O.some(3)),
  7.1,
); // true
pipeAndLog(
  E7.equals(O.none, O.some(4)),
  7.2,
); // false
pipeAndLog(
  E7.equals(O.none, O.none),
  7.3,
); // true

const E8 = E.getEq(S.Eq, N.Eq);
pipeAndLog(
  E8.equals(E.right(3), E.right(3)),
  8.1,
); // true
pipeAndLog(
  E8.equals(E.left('3'), E.right(3)),
  8.2,
); // false
pipeAndLog(
  E8.equals(E.left('3'), E.left('3')),
  8.3,
); // true
