import * as A from 'fp-ts/Apply';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import { log } from './utils/log';

const deepThought: T.Task<number> = async () => Promise.resolve(42);

void pipe(
  deepThought,
  T.map((n) => `The answer is ${n}.`),
  T.map(log(1)),
)();

const fetchGreeting = TE.tryCatch<Error, { name: string }>(
  async () => new Promise((resolve) => { resolve(JSON.parse('{ "name": "Carol" }')); }),
  (reason) => new Error(String(reason)),
);

void pipe(
  fetchGreeting,
  TE.fold(
    (err) => T.of(`I'm sorry, I don't know who you are. (${err.message})`),
    (x) => T.of(`Hello, ${x.name}!`),
  ),
  T.map(log(2)),
)();

void pipe(
  async () => Promise.all([Promise.resolve(1), Promise.resolve(2)]),
  T.map(log(3)),
)();

void pipe(
  T.sequenceArray([T.of(3), T.of(3)]),
  T.map(log(4)),
)();

const generateTasks = (m: string | number) => [
  pipe(T.delay(200)(T.of('firstx')), T.map((a) => { log(m)(a); return a; })),
  pipe(T.delay(100)(T.of('secondx')), T.map((a) => { log(m)(a); return a; })),
];

void T.sequenceArray(generateTasks(5.1))();

void T.sequenceSeqArray(generateTasks(5.2))();

// const tasks = [T.of(1), T.of('hello')];
// T.sequenceArray(tasks);
// ~~~~~ Argument of type '(Task<number> | Task<string>)[]' is not assignable to parameter of type 'Task<number>[]'.
//   Type 'Task<number> | Task<string>' is not assignable to type 'Task<number>'.
//     Type 'Task<string>' is not assignable to type 'Task<number>'.
//       Type 'string' is not assignable to type 'number'.

// sequenceT combines tasks into a tuple
void pipe(
  A.sequenceT(T.ApplyPar)(T.of(1), T.of('hello')),
  T.map((result) => {
    log('6 sequenceT result:')(result);
    return result;
  }),
)();

// sequenceS combines tasks into a struct/object
void pipe(
  A.sequenceS(T.ApplyPar)({ a: T.of(1), b: T.of('hello') }),
  T.map((result) => {
    log('7 sequenceS result:')(result);
    return result;
  }),
)();

void pipe(
  T.of(2),
  T.chain((result) => T.of(result * 3)),
  T.chain((result) => T.of(result + 4)),
  T.map((result) => {
    log(8)(result);
    return result;
  }),
)();

const checkPathExists = (path: string) => async () => new Promise((resolve) => {
  resolve({ path, exists: !path.startsWith('/no/') });
});

const program = pipe(
  ['/bin', '/no/real/path'],
  T.traverseArray(checkPathExists),
);

void pipe(
  program,
  T.map((result) => {
    log(9)(result);
    return result;
  }),
)();
