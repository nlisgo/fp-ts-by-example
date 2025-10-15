import * as D from 'fp-ts/Date';
import * as Eq from 'fp-ts/Eq';
import * as RA from 'fp-ts/ReadonlyArray';
import * as B from 'fp-ts/boolean';
import { pipe } from 'fp-ts/function';
import * as N from 'fp-ts/number';
import * as S from 'fp-ts/string';
import { log } from './utils/log';

pipe(B.Eq.equals(false, true), log('1.1.1')); // false
pipe(B.Eq.equals(true, true), log('1.1.2')); // true
pipe(D.Eq.equals(new Date('1984-01-27'), new Date('1984-01-28')), log('1.2.1')); // false
pipe(D.Eq.equals(new Date('1984-01-27'), new Date('1984-01-27')), log('1.2.2')); // true
pipe(N.Eq.equals(2, 3), log('1.3.1')); // false
pipe(N.Eq.equals(3, 3), log('1.3.2')); // true
pipe(S.Eq.equals('Cindi', 'Cyndi'), log('1.4.1')); // false
pipe(S.Eq.equals('Cyndi', 'Cyndi'), log('1.4.2')); // true

type Point = {
  x: number,
  y: number,
};

const eqPoint: Eq.Eq<Point> = Eq.struct({
  x: N.Eq,
  y: N.Eq,
});

pipe(eqPoint.equals({ x: 0, y: 1 }, { x: 0, y: 0 }), log(2.1)); // false
pipe(eqPoint.equals({ x: 0, y: 0 }, { x: 0, y: 0 }), log(2.2)); // true

type Vector = {
  from: Point,
  to: Point,
};

const eqVector: Eq.Eq<Vector> = Eq.struct({
  from: eqPoint,
  to: eqPoint,
});

pipe(
  eqVector.equals(
    { from: { x: 0, y: 1 }, to: { x: 0, y: 0 } },
    { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } },
  ),
  log(3.1),
); // false
pipe(
  eqVector.equals(
    { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } },
    { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } },
  ),
  log(3.2),
); // true

const eqArrayOfStrings = RA.getEq(S.Eq);

pipe(
  eqArrayOfStrings.equals(['Timex', 'After', 'Time'], ['Time', 'After', 'Time']),
  log(4.1),
); // false
pipe(
  eqArrayOfStrings.equals(['Time', 'After', 'Time'], ['Time', 'After', 'Time']),
  log(4.2),
); // true

const eqArrayOfPoints = RA.getEq(eqPoint);

pipe(
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
  log(5.1),
); // false
pipe(
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
  log(5.2),
); // true

type User = {
  userId: number,
  name: string,
};

const eqUserId = Eq.contramap((user: User) => user.userId)(N.Eq);

pipe(
  eqUserId.equals({ userId: 1, name: 'Giulio' }, { userId: 1, name: 'Giulio Canti' }),
  log(6.1),
); // true
pipe(
  eqUserId.equals({ userId: 1, name: 'Giulio' }, { userId: 2, name: 'Giulio' }),
  log(6.2),
); // false
