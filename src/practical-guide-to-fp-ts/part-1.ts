import { pipe } from 'fp-ts/function';
import { pipeAndLog } from '../utils/log';

const add1 = (num: number) => num + 1;

const multiply2 = (num: number) => num * 2;

pipeAndLog(
  pipe(
    1,
    add1,
    multiply2,
  ),
  1,
); // 4
