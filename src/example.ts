import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

// Hello World with fp-ts Option
const greet = (name: string | null): O.Option<string> => pipe(
  O.fromNullable(name),
  O.map((n) => `Hello, ${n}!`),
);

console.log('=== Option Example ===');
console.log(greet('World')); // Some("Hello, World!")
console.log(greet(null)); // None

// Working with Either for error handling
const divide = (a: number, b: number): E.Either<string, number> => (b === 0
  ? E.left('Cannot divide by zero')
  : E.right(a / b));

console.log('\n=== Either Example ===');
console.log(divide(10, 2)); // Right(5)
console.log(divide(10, 0)); // Left("Cannot divide by zero")

// Combining pipe with transformations
const processNumber = (n: number): string => pipe(
  n,
  (x) => x * 2,
  (x) => x + 10,
  (x) => `Result: ${x}`,
);

console.log('\n=== Pipe Example ===');
console.log(processNumber(5)); // "Result: 20"
