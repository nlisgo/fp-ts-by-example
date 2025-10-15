import { option } from 'fp-ts';
import { some } from 'fp-ts/Option';
import * as O from 'fp-ts/Option';
import { flow, pipe } from 'fp-ts/function';
import { log } from './utils/log';

pipe(
  option.some(1),
  log(1),
);

pipe(
  some(2),
  log(2),
);

pipe(
  O.some(3),
  log(3),
);

const pipeAdd5 = (x: number) => x + 5;
const pipeMultiply2 = (x: number) => x * 2;

const pipeOne = pipeMultiply2(pipeAdd5(3)); // Ok
const pipeTwo = pipe(3, pipeAdd5, pipeMultiply2); // Better

log(4.1)(pipeOne); // 16
log(4.2)(pipeTwo); // 16

const flowAdd5 = (x: number) => x + 5;

const runPipe = (x: number) => pipe(x, pipeAdd5);
// eslint-disable-next-line fp-ts/no-redundant-flow
const runFlow = flow(flowAdd5);

log(5.1)(runPipe(3)); // 8
log(5.2)(runFlow(3)); // 8
