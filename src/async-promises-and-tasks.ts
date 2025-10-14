import * as A from "fp-ts/Apply";
import * as T from "fp-ts/Task";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/function";

const deepThought: T.Task<number> = () => Promise.resolve(42);

deepThought().then((n) => {
  console.log(`The answer is ${n}.`);
});

const fetchGreeting = TE.tryCatch<Error, { name: string }>(
  () => new Promise((resolve) => resolve(JSON.parse('{ "name": "Carol" }'))),
  (reason) => new Error(String(reason)),
);

fetchGreeting()
  .then((e) =>
    pipe(
      e,
      E.fold(
        (err) => `I'm sorry, I don't know who you are. (${err.message})`,
        (x) => `Hello, ${x.name}!`
      )
    )
  )
  .then(console.log);

Promise.all([Promise.resolve(1), Promise.resolve(2)]).then(console.log); // [1, 2]

const tasks1 = [T.of(3), T.of(3)];
T.sequenceArray(tasks1)().then(console.log); // [ 3, 4 ]

const log = <A>(x: A) => {
  console.log(x);
  return x;
};

const tasks2 = [
  pipe(T.delay(200)(T.of("first")), T.map(log)),
  pipe(T.delay(100)(T.of("second")), T.map(log)),
];

// Parallel: logs 'second' then 'first'
T.sequenceArray(tasks2)();

// Sequential: logs 'first' then 'second'
T.sequenceSeqArray(tasks2)();

const tasks3 = [T.of(1), T.of("hello")];
// T.sequenceArray(tasks3);
// ~~~~~ Argument of type '(Task<number> | Task<string>)[]' is not assignable to parameter of type 'Task<number>[]'.
//   Type 'Task<number> | Task<string>' is not assignable to type 'Task<number>'.
//     Type 'Task<string>' is not assignable to type 'Task<number>'.
//       Type 'string' is not assignable to type 'number'.

// sequenceT combines tasks into a tuple
pipe(
  A.sequenceT(T.ApplyPar)(T.of(1), T.of("hello")),
  T.map((result) => {
    console.log("sequenceT result:", result); // [1, "hello"]
    return result;
  })
)();

// sequenceS combines tasks into a struct/object
pipe(
  A.sequenceS(T.ApplyPar)({ a: T.of(1), b: T.of("hello") }),
  T.map((result) => {
    console.log("sequenceS result:", result); // { a: 1, b: "hello" }
    return result;
  })
)();

pipe(
  T.of(2),
  T.chain((result) => T.of(result * 3)),
  T.chain((result) => T.of(result + 4)),
  T.map((result) => {
    console.log(result); // 10
    return result;
  })
)();

const checkPathExists = (path: string) => () =>
  new Promise((resolve) => {
    resolve({ path, exists: !path.startsWith('/no/') })
  });

const program = pipe(
  ["/bin", "/no/real/path"],
  T.traverseArray(checkPathExists)
);

pipe(
  program,
  T.map((result) => {
    console.log(result); // [ { path: '/bin', exists: true }, { path: '/no/real/path', exists: false } ]
    return result;
  }),
)();
