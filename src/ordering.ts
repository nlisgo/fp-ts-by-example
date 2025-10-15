import * as D from 'fp-ts/Date';
import { concatAll } from 'fp-ts/Monoid';
import * as O from 'fp-ts/Option';
import * as Ord from 'fp-ts/Ord';
import * as RA from 'fp-ts/ReadonlyArray';
import * as B from 'fp-ts/boolean';
import { pipe } from 'fp-ts/function';
import * as N from 'fp-ts/number';
import * as S from 'fp-ts/string';
import { pipeAndLog } from './utils/log';

pipeAndLog(N.Ord.compare(4, 5), 1.1); // -1
pipeAndLog(N.Ord.compare(5, 5), 1.2); // 0
pipeAndLog(N.Ord.compare(6, 5), 1.3); // 1

pipeAndLog(B.Ord.compare(true, false), 1.4); // 1
pipeAndLog(D.Ord.compare(new Date('1984-01-27'), new Date('1978-09-23')), 1.5); // 1
pipeAndLog(S.Ord.compare('Cyndi', 'Debbie'), 1.6); // -1

pipeAndLog(Ord.equals(B.Ord)(false)(false), 2); // true

// eslint-disable-next-line no-nested-ternary
const strlenOrd3 = Ord.fromCompare((a: string, b: string) => (a.length < b.length ? -1 : a.length > b.length ? 1 : 0));
pipeAndLog(strlenOrd3.compare('Hi', 'there'), 3.1); // -1
pipeAndLog(strlenOrd3.compare('Goodbye', 'friend'), 3.2); // 1

const strlenOrd4 = Ord.contramap((s: string) => s.length)(N.Ord);
pipeAndLog(strlenOrd4.compare('Hi', 'there'), 4.1); // -1
pipeAndLog(strlenOrd4.compare('Goodbye', 'friend'), 4.2); // 1

pipeAndLog(Ord.min(N.Ord)(5, 2), 5.1); // 2
pipeAndLog(Ord.max(N.Ord)(5, 2), 5.2); // 5

pipeAndLog(Ord.clamp(N.Ord)(3, 7)(2), 5.3); // 3
pipeAndLog(Ord.clamp(S.Ord)('Bar', 'Boat')('Ball'), 5.4); // Bar

pipeAndLog(Ord.lt(N.Ord)(4, 7), 6.1); // true
pipeAndLog(Ord.geq(N.Ord)(6, 6), 6.2); // true

pipeAndLog(Ord.between(N.Ord)(6, 9)(7), 6.3); // true
pipeAndLog(Ord.between(N.Ord)(6, 9)(6), 6.4); // true
pipeAndLog(Ord.between(N.Ord)(6, 9)(9), 6.5); // true
pipeAndLog(Ord.between(N.Ord)(6, 9)(12), 6.6); // false

pipeAndLog(pipe(
  [3, 1, 2],
  RA.sort(N.Ord),
), 7); // [1, 2, 3]

pipeAndLog(pipe(
  [
    [3, 2, 1], // 6
    [9, 7, 6, 8], // 30
    [1, 4], // 5
  ],
  pipe(
    N.Ord,
    pipe(
      RA.reduce(0, N.SemigroupSum.concat),
      Ord.contramap,
    ),
    RA.sort,
  ),
  // RA.sort(Ord.contramap(RA.reduce(0, N.SemigroupSum.concat))(N.Ord)),
), 8); // [ [ 1, 4 ], [ 3, 2, 1 ], [ 9, 7, 6, 8 ] ]

type Planet = {
  name: string,
  diameter: number, // km
  distance: number, // AU from Sun
};

const planets: ReadonlyArray<Planet> = [
  { name: 'Earth', diameter: 12756, distance: 1 },
  { name: 'Jupiter', diameter: 142800, distance: 5.203 },
  { name: 'Mars', diameter: 6779, distance: 1.524 },
  { name: 'Mercury', diameter: 4879.4, distance: 0.39 },
  { name: 'Neptune', diameter: 49528, distance: 30.06 },
  { name: 'Saturn', diameter: 120660, distance: 9.539 },
  { name: 'Uranus', diameter: 51118, distance: 19.18 },
  { name: 'Venus', diameter: 12104, distance: 0.723 },
  { name: 'Nibiru', diameter: 142400, distance: 409 },
  { name: 'Nibira', diameter: 142400, distance: 409 },
];

const diameterOrd = pipe(
  N.Ord,
  Ord.contramap((x: Planet) => x.diameter),
);
const distanceOrd = pipe(
  N.Ord,
  Ord.contramap((x: Planet) => x.distance),
);

pipeAndLog(pipe(
  planets,
  pipe(
    distanceOrd,
    RA.sort,
  ),
), '9.1 distance'); // Mercury, Venus, Earth, Mars, ...
pipeAndLog(pipe(
  planets,
  pipe(
    diameterOrd,
    RA.sort,
  ),
), '9.2 diameter'); // Mercury, Mars, Venus, Earth, ...

const nameOrd = pipe(
  S.Ord,
  Ord.contramap((x: Planet) => x.name),
);

const semigroup = Ord.getSemigroup<Planet>();
const monoid = Ord.getMonoid<Planet>();

const diameterDistanceOrd = semigroup.concat(diameterOrd, distanceOrd); // combine 2 Ord
const diameterDistanceNameOrd = pipe(
  [diameterOrd, distanceOrd, nameOrd],
  concatAll(monoid),
); // combine 3 Ord

pipeAndLog(pipe(
  planets,
  pipe(
    diameterDistanceOrd,
    RA.sort,
  ),
), '10.1 diameter-distance order'); // Mercury, Mars, Venus, Earth, ... , Nibiru, Nibira, Jupiter;
pipeAndLog(pipe(
  planets,
  pipe(
    diameterDistanceNameOrd,
    RA.sort,
  ),
), '10.2 diameter-distance-name order'); // Mercury, Mars, Venus, Nibiru, ... , Nibira, Nibiru, Jupiter

const OOrd = O.getOrd(N.Ord);
pipeAndLog(OOrd.compare(O.none, O.none), 11.1); // 0
pipeAndLog(OOrd.compare(O.none, O.some(1)), 11.2); // -1
pipeAndLog(OOrd.compare(O.some(1), O.none), 11.3); // 1
pipeAndLog(OOrd.compare(O.some(1), O.some(2)), 11.4); // -1
pipeAndLog(OOrd.compare(O.some(1), O.some(1)), 11.5); // 0

const tuple = Ord.tuple(S.Ord, N.Ord);
pipeAndLog(tuple.compare(['A', 10], ['A', 12]), 12.1); // -1
pipeAndLog(tuple.compare(['A', 10], ['A', 4]), 12.2); // 1
pipeAndLog(tuple.compare(['A', 10], ['B', 4]), 12.3); // -1
