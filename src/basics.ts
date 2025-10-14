import { option } from 'fp-ts';
import { Option, some } from 'fp-ts/Option';
import * as O from 'fp-ts/Option';
import { flow, pipe } from 'fp-ts/function';

const value1: option.Option<number> = option.some(1);
console.log(value1);

const value2: Option<number> = some(2);
console.log(value2);

const value3: O.Option<number> = O.some(3);
console.log(value3);

const pipeAdd5 = (x: number) => x + 5;
const pipeMultiply2 = (x: number) => x * 2;

const pipeOne = pipeMultiply2(pipeAdd5(3)); // Ok
const pipeTwo = pipe(3, pipeAdd5, pipeMultiply2); // Better

console.log(pipeOne, pipeTwo); // 16, 16

const flowAdd5 = (x: number) => x + 5;

const runPipe = (x: number) => pipe(x, pipeAdd5);
// eslint-disable-next-line fp-ts/no-redundant-flow
const runFlow = flow(flowAdd5);

console.log(runPipe(3), runFlow(3)); // 8, 8
