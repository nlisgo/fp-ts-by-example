import * as D from 'fp-ts/Date';
import * as Eq from 'fp-ts/Eq';
import * as B from 'fp-ts/boolean';
import { pipe } from 'fp-ts/function';
import * as N from 'fp-ts/number';
import * as S from 'fp-ts/string';

pipe(B.Eq.equals(false, true), console.log); // false
pipe(B.Eq.equals(true, true), console.log); // true
pipe(D.Eq.equals(new Date('1984-01-27'), new Date('1984-01-28')), console.log); // false
pipe(D.Eq.equals(new Date('1984-01-27'), new Date('1984-01-27')), console.log); // true
pipe(N.Eq.equals(2, 3), console.log); // false
pipe(N.Eq.equals(3, 3), console.log); // true
pipe(S.Eq.equals('Cindi', 'Cyndi'), console.log); // false
pipe(S.Eq.equals('Cyndi', 'Cyndi'), console.log); // true

type Point = {
  x: number,
  y: number,
};

const eqPoint: Eq.Eq<Point> = Eq.struct({
  x: N.Eq,
  y: N.Eq,
});

pipe(eqPoint.equals({ x: 0, y: 1 }, { x: 0, y: 0 }), console.log); // false
pipe(eqPoint.equals({ x: 0, y: 0 }, { x: 0, y: 0 }), console.log); // true
