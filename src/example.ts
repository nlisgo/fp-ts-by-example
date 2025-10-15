import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import { log } from './utils/log';

// Hello World with fp-ts Option
const greet = (name: string | null): O.Option<string> => pipe(
  O.fromNullable(name),
  O.map((n) => `Hello, ${n}!`),
);

log(1.1)('=== Option Example ===');
log(1.2)(greet('World')); // Some("Hello, World!")
log(1.3)(greet(null)); // None

// Working with Either for error handling
const divide = (a: number, b: number): E.Either<string, number> => (b === 0
  ? E.left('Cannot divide by zero')
  : E.right(a / b));

log(2.1)('\n=== Either Example ===');
log(2.2)(divide(10, 2)); // Right(5)
log(2.3)(divide(10, 0)); // Left("Cannot divide by zero")

// Combining pipe with transformations
const processNumber = (n: number): string => pipe(
  n,
  (x) => x * 2,
  (x) => x + 10,
  (x) => `Result: ${x}`,
);

log(3.1)('\n=== Pipe Example ===');
log(3.2)(processNumber(5)); // "Result: 20"
