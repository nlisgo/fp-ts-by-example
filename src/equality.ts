import {
  boolean, date, number, string,
} from 'fp-ts';
import { pipe } from 'fp-ts/function';

pipe(boolean.Eq.equals(true, true), console.log); // true
date.Eq.equals(new Date('1984-01-27'), new Date('1984-01-27')); // true
number.Eq.equals(3, 3); // true
string.Eq.equals('Cyndi', 'Cyndi'); // true
