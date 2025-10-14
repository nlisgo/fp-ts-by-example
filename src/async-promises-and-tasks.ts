import * as T from "fp-ts/Task";

const deepThought: T.Task<number> = () => Promise.resolve(42);

deepThought().then((n) => {
  console.log(`The answer is ${n}.`);
});
