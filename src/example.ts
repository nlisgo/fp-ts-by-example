import axios from 'axios';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import * as N from 'fp-ts/number';
import * as t from 'io-ts';
import parseLinkHeader from 'parse-link-header';
import { log, pipeAndLog } from './utils/log';

// Hello World with fp-ts Option
const greet = (name: string | null): O.Option<string> => pipe(
  O.fromNullable(name),
  O.map((n) => `Hello, ${n}!`),
);

log('=== Option Example ===')();
log(1.1)(greet('World')); // Some("Hello, World!")
log(1.2)(greet(null)); // None

// Working with Either for error handling
const divide = (a: number, b: number): E.Either<string, number> => (b === 0
  ? E.left('Cannot divide by zero')
  : E.right(a / b));

log('\n=== Either Example ===')();
log(2.1)(divide(10, 2)); // Right(5)
log(2.2)(divide(10, 0)); // Left("Cannot divide by zero")

// Combining pipe with transformations
const processNumber = (n: number): string => pipe(
  n,
  (x) => x * 2,
  (x) => x + 10,
  (x) => `Result: ${x}`,
);

log('\n=== Pipe Example ===')();
pipeAndLog(
  pipe(
    5,
    processNumber,
  ),
  3,
); // "Result: 20"

log('\n=== Other ===')();
const addBasic = (a: number) => (b?: number) => a + (b ?? 0);

// Chainable sum using fp-ts Monoid for numbers
type AddFn = ((n: number) => AddFn) & (() => number);
const add = (initial: number = 0): AddFn => Object.assign(
  (n?: number) => (n !== undefined ? add(N.MonoidSum.concat(initial, n)) : initial),
  {},
) as AddFn;

pipe(
  addBasic(1)(),
  addBasic(2),
  addBasic(3),
  addBasic(4),
  log(4.1, 'total:'),
);

pipe(
  add(1)(2)(3)(4)(5)(),
  log(4.2, 'total:'),
);

void (async () => {
  const notificationCodec = t.type({
    object: t.type({
      id: t.string,
    }),
  });

  const headersLinkCodec = t.type({
    link: t.string,
  });

  const parsedHeadersLinkCodec = t.type({
    describedby: t.type({
      url: t.string,
      type: t.literal('application/ld+json'),
    }),
  });

  const stepCodec = t.intersection([
    t.strict({
      inputs: t.readonlyArray(
        t.strict({
          doi: t.string,
        }),
      ),
      actions: t.readonlyArray(
        t.strict({
          outputs: t.readonlyArray(
            t.strict({
              published: t.string,
              doi: t.string,
              type: t.string,
            }),
          ),
          inputs: t.readonlyArray(
            t.strict({
              doi: t.string,
            }),
          ),
        }),
      ),
    }),
    t.partial({
      'next-step': t.string,
      'previous-step': t.string,
    }),
  ]);

  const stepsCodec = t.record(t.string, stepCodec);

  const docmapsCodec = t.readonlyArray(t.type({
    type: t.literal('docmap'),
    id: t.string,
    publisher: t.type({
      name: t.string,
      url: t.string,
    }),
    created: t.string,
    updated: t.string,
    'first-step': t.literal('_:b0'),
    steps: stepsCodec,
    '@context': t.string,
  }));

  const toError = (reason: unknown) => new Error(reason instanceof Error ? reason.message : String(reason));

  const normaliseLinkHeader = (raw: string) => raw
    .replace(/>\s*;\s*/g, '>; ')
    .replace(/(?<!;)\s+(?=(type|profile|title|rev)=)/g, '; ')
    .replace(/;\s*;/g, '; ')
    .trim();

  const axiosGet = (url: string) => TE.tryCatch(async () => axios.get<unknown>(url), toError);

  const axiosHead = (url: string) => TE.tryCatch(async () => axios.head(url), toError);

  const program = pipe(
    axiosGet('https://inbox-sciety-prod.elifesciences.org/inbox/urn:uuid:bf3513ee-1fef-4f30-a61b-20721b505f11'),
    TE.chainEitherKW(({ data }) => pipe(data, notificationCodec.decode, E.map((n) => n.object.id))),
    TE.chainW(axiosHead),
    TE.chainEitherKW(({ headers }) => pipe(
      headersLinkCodec.decode(headers),
      E.map(({ link }) => pipe(
        normaliseLinkHeader(link)
          .split(', ')
          .map(parseLinkHeader),
        RA.filter((l): l is NonNullable<typeof l> => l != null),
        RA.map(parsedHeadersLinkCodec.decode),
        RA.filterMap(E.matchW(() => O.none, O.some)),
        RA.last,
        O.map((l) => l.describedby.url),
        TE.fromOption(() => new Error('No application/ld+json describedby link found')),
      )),
    )),
    TE.chainW((links) => pipe(
      links,
      TE.chainW(axiosGet),
      TE.map(({ data }) => pipe(
        data,
        docmapsCodec.decode,
        E.chainW((docmaps) => pipe(
          docmaps,
          RA.head,
          E.fromOption(() => new Error('Docmaps array is empty')),
        )),
        E.map((docmap) => {
          const steps = docmap.steps;
          const entries = Object.entries(steps).map(([k, v]) => ({
            step: k,
            ...(v['previous-step'] ? { previous: v['previous-step'] } : {}),
            ...(v['next-step'] ? { next: v['next-step'] } : {}),
            actions: v.actions.map(({ inputs, outputs }) => ({
              inputs: inputs.map(({ doi }) => ({ doi })),
              outputs: outputs.map(({ doi, type }) => ({ doi, type })),
            })),
            inputs: v.inputs.map(({ doi }) => ({ doi })),
          }));
          console.log(JSON.stringify(entries, null, 2));
          return docmap;
        }),
      )),
    )),
  );

  pipeAndLog(await program(), 4.3);
})();
