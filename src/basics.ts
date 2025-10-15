import { option } from 'fp-ts';
import { some } from 'fp-ts/Option';
import * as O from 'fp-ts/Option';
import { flow, pipe } from 'fp-ts/function';
import { pipeAndLog } from './utils/log';

pipeAndLog(option.some(1), 1);

pipeAndLog(some(2), 2);

pipeAndLog(O.some(3), 3);

const pipeAdd5 = (x: number) => x + 5;
const pipeMultiply2 = (x: number) => x * 2;

const pipeOne = pipeMultiply2(pipeAdd5(3)); // Ok
const pipeTwo = pipe(3, pipeAdd5, pipeMultiply2); // Better

pipeAndLog(pipeOne, 4.1); // 16
pipeAndLog(pipeTwo, 4.2); // 16

const flowAdd5 = (x: number) => x + 5;

const runPipe = (x: number) => pipe(x, pipeAdd5);
// eslint-disable-next-line fp-ts/no-redundant-flow
const runFlow = flow(flowAdd5);

pipeAndLog(runPipe(3), 5.1); // 8
pipeAndLog(runFlow(3), 5.2); // 8
