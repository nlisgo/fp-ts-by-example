import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import * as N from 'fp-ts/number';
import { log, pipeAndLog } from './utils/log';

// Hello World with fp-ts Option
const greet = (name: string | null): O.Option<string> => pipe(
  O.fromNullable(name),
  O.map((n) => `Hello, ${n}!`),
);

log('=== Option Example ===')();
log(1.1)(greet('World')); // Some("Hello, World!")
log(1.2)(greet(null)); // None

// Working with Either for error handling
const divide = (a: number, b: number): E.Either<string, number> => (b === 0
  ? E.left('Cannot divide by zero')
  : E.right(a / b));

log('\n=== Either Example ===')();
log(2.1)(divide(10, 2)); // Right(5)
log(2.2)(divide(10, 0)); // Left("Cannot divide by zero")

// Combining pipe with transformations
const processNumber = (n: number): string => pipe(
  n,
  (x) => x * 2,
  (x) => x + 10,
  (x) => `Result: ${x}`,
);

log('\n=== Pipe Example ===')();
pipeAndLog(
  pipe(
    5,
    processNumber,
  ),
  3,
); // "Result: 20"

log('\n=== Other ===')();
const addBasic = (a: number) => (b?: number) => a + (b ?? 0);

// Chainable sum using fp-ts Monoid for numbers
type AddFn = ((n: number) => AddFn) & (() => number);
const add = (initial: number = 0): AddFn => Object.assign(
  (n?: number) => (n !== undefined ? add(N.MonoidSum.concat(initial, n)) : initial),
  {},
) as AddFn;

pipe(
  addBasic(1)(),
  addBasic(2),
  addBasic(3),
  addBasic(4),
  log(4.1, 'total:'),
);

pipe(
  add(1)(2)(3)(4)(5)(),
  log(4.2, 'total:'),
);
