import * as crypto from 'crypto';
import axios from 'axios';
import * as E from 'fp-ts/Either';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import {
  absurd,
  constVoid,
  flow,
  pipe,
  unsafeCoerce,
} from 'fp-ts/function';
import { pipeAndLog } from '../utils/log';

class MinLengthValidationError extends Error {
  public minLength: number;

  private constructor(minLength: number) {
    super(`password fails to meet min length requirement: ${minLength}`);
    this.minLength = minLength;
  }

  public static of(minLength: number): MinLengthValidationError {
    return new MinLengthValidationError(minLength);
  }
}

class CapitalLetterMissingValidationError extends Error {
  private constructor() {
    super('password is missing a capital letter');
  }

  public static of(): CapitalLetterMissingValidationError {
    return new CapitalLetterMissingValidationError();
  }
}

type PasswordValidationError =
  | MinLengthValidationError
  | CapitalLetterMissingValidationError;

type Password = {
  _tag: 'Password',
  value: string,
  isHashed: boolean,
};

const of = (value: string): Password => ({ _tag: 'Password', value, isHashed: false });

// const fromHashed = (value: string): Password => ({ _tag: 'Password', value, isHashed: true });

type PasswordSpecification = {
  minLength?: number,
  capitalLetterRequired?: boolean,
};

const validate = ({
  minLength = 0,
  capitalLetterRequired = false,
}: PasswordSpecification = {}) => (password: Password): E.Either<PasswordValidationError, Password> => {
  if (password.value.length < minLength) {
    return E.left(MinLengthValidationError.of(minLength));
  }

  if (capitalLetterRequired && !/[A-Z]/.test(password.value)) {
    return E.left(CapitalLetterMissingValidationError.of());
  }

  return E.right({ ...password, isValidated: true });
};

{
  type HashFn = (value: string) => string;

  const hash = (hashFn: HashFn) => (password: Password): Password => ({
    ...password,
    value: hashFn(password.value),
    isHashed: true,
  });

  const pipeline = flow(
    of,
    validate({ minLength: 8, capitalLetterRequired: true }),
    E.map(
      hash((value) => crypto.createHash('md5').update(value).digest('hex')),
    ),
  );

  pipeAndLog(
    pipe(
      'pw123',
      pipeline,
    ),
    1.1,
  );

  pipeAndLog(
    pipe(
      'Password123',
      pipeline,
    ),
    1.2,
  );
}

{
  type HashFn = (value: string) => E.Either<Error, string>;

  const hash = (hashFn: HashFn) => (password: Password): E.Either<Error, Password> => pipe(
    hashFn(password.value),
    E.map((value) => ({
      ...password,
      value,
      isHashed: true,
    })),
  );

  const pipeline = flow(
    of,
    validate({ minLength: 8, capitalLetterRequired: true }),
    E.chainW(
      hash((value) => E.right(crypto.createHash('md5').update(value).digest('hex'))),
    ),
  );

  pipeAndLog(
    pipe(
      'pw123',
      pipeline,
    ),
    2.1,
  );

  pipeAndLog(
    pipe(
      'Password123',
      pipeline,
    ),
    2.2,
  );
}

void (async () => {
  pipeAndLog(await pipe(
    TE.tryCatch(
      async () => axios.get<string>('https://mock.httpstatus.io/200'),
      (reason) => new Error(
        reason instanceof Error ? reason.message : String(reason),
      ),
    ),
    TE.map((resp) => resp.data),
  )(), 3.1);
  // { _tag: 'Right', right: '200 OK' }
})();

type Resp = string;

void (async () => {
  pipeAndLog(await pipe(
    TE.tryCatch(
      async () => axios.get<string>('https://mock.httpstatus.io/500'),
      (reason) => new Error(
        reason instanceof Error ? reason.message : String(reason),
      ),
    ),
    TE.map((resp) => resp.data),
  )(), 3.2);
  /**
   * {
   *   _tag: 'Left',
   *   left: Error: Error: Request failed with status code 500
   *       at /tmp/either-demo/taskeither.ts:19:19
   *       at /tmp/either-demo/node_modules/fp-ts/lib/TaskEither.js:94:85
   *       at processTicksAndRejections (internal/process/task_queues.js:97:5)
   * }
   */
})();

void (async () => {
  pipeAndLog(await pipe(
    TE.tryCatch(
      async () => axios.get('https://mock.httpstatus.io/200'),
      () => constVoid() as never,
    ),
    TE.map((resp) => unsafeCoerce<unknown, Resp>(resp.data)),
    TE.fold(absurd, T.of),
  )(), 3.3);
})();

declare const begin: () => Promise<void>;
declare const commit: () => Promise<void>;
declare const rollback: () => Promise<void>;

void (async () => {
  pipeAndLog(await pipe(
    TE.tryCatch(
      async () => begin(),
      (err) => new Error(`begin txn failed: ${err instanceof Error ? err.message : String(err)}`),
    ),
    TE.chain(() => TE.tryCatch(
      async () => commit(),
      (err) => new Error(`commit txn failed: ${err instanceof Error ? err.message : String(err)}`),
    )),
    TE.orElse((originalError) => pipe(
      TE.tryCatch(
        async () => rollback(),
        (err) => new Error(`rollback txn failed: ${err instanceof Error ? err.message : String(err)}`),
      ),
      TE.chainFirst(() => TE.left(originalError)),
    )),
  )(), 4);
})();
