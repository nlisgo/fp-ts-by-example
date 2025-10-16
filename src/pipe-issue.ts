import * as M from 'fp-ts/Map';
import * as O from 'fp-ts/Option';
import { flow, pipe } from 'fp-ts/function';
import * as S from 'fp-ts/string';
import { log } from './utils/log';

const ids = new Map<string, number>([
  ['one', 1],
]);

const solutionMLookupFlow = flow(
  (input: string) => M.lookup(S.Eq)(input, ids),
  O.map((v) => `Value: ${v}`),
);

const solutionMLookupPipe = (input: string) => pipe(
  input,
  (id) => M.lookup(S.Eq)(id, ids),
  O.map((v) => `Value: ${v}`),
);

const solutionMGetFlow = flow(
  (input: string) => ids.get(input),
  O.fromNullable,
  O.map((v) => `Value: ${v}`),
);

const solutionMGetPipe = (input: string) => pipe(
  input,
  // ids.get, // TypeError: Method Map.prototype.get called on incompatible receiver undefined
  (id) => ids.get(id), // Curry doesn't seem to work for this
  O.fromNullable,
  O.map((v) => `Value: ${v}`),
);

log('solutionMLookupFlow', 'one')(solutionMLookupFlow('one'));
log('solutionMLookupFlow', 'unknown')(solutionMLookupFlow('unknown'));
log('solutionMGetFlow', 'one')(solutionMGetFlow('one'));
log('solutionMGetFlow', 'unknown')(solutionMGetFlow('unknown'));
log('solutionMLookupPipe', 'one')(solutionMLookupPipe('one'));
log('solutionMLookupPipe', 'unknown')(solutionMLookupPipe('unknown'));
log('solutionMGetPipe', 'one')(solutionMGetPipe('one'));
log('solutionMGetPipe', 'unknown')(solutionMGetPipe('unknown'));
