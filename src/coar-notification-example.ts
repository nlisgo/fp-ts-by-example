import axios from 'axios';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import * as t from 'io-ts';
import parseLinkHeader from 'parse-link-header';
import { log } from './utils/log';

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

  const docmapCodec = t.strict({
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
  });

  const docmapsCodec = t.readonlyArray(docmapCodec);

  const toError = (reason: unknown) => new Error(reason instanceof Error ? reason.message : String(reason));

  const normaliseLinkHeader = (raw: string) => raw
    .replace(/>\s*;\s*/g, '>; ')
    .replace(/(?<!;)\s+(?=(type|profile|title|rev)=)/g, '; ')
    .replace(/;\s*;/g, '; ')
    .trim();

  const axiosGet = (url: string) => TE.tryCatch(async () => axios.get<unknown>(url), toError);

  const axiosHead = (url: string) => TE.tryCatch(async () => axios.head(url), toError);

  const program = (debug: DebugLevel = [0]) => (url: string) => {
    const logUrl = (message: string) => (urlToLog: string) => {
      if (debug.includes(0)) {
        log(`${message}: ${urlToLog}`)('Debug level: 0');
      }
      return urlToLog;
    };

    return pipe(
      url,
      logUrl('Retrieve Docmap url from notification'),
      axiosGet,
      TE.chainEitherKW(({ data }) => pipe(data, notificationCodec.decode, E.map((n) => n.object.id))),
      TE.chainW((u) => pipe(
        u,
        logUrl('Step 1: retrieved evaluation url'),
        axiosHead,
      )),
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
        TE.chainW((u) => pipe(
          u,
          logUrl('Step 2: retrieved Docmap url'),
          axiosGet,
        )),
        TE.map(({ data }) => pipe(
          data,
          docmapsCodec.decode,
          E.chainW((docmaps) => pipe(
            docmaps,
            RA.head,
            E.fromOption(() => new Error('Docmaps array is empty')),
          )),
        )),
      )),
    );
  };

  type DebugLevel = Array<0 | 1 | 2>;

  type ProgramConfig = {
    url: string,
    debug?: DebugLevel,
  };

  const runProgram = async (url: ProgramConfig['url'], debug: ProgramConfig['debug'] = [0]) => pipe(
    url,
    program(debug),
    TE.map((eitherDocmap) => pipe(
      eitherDocmap,
      E.map((docmap) => {
        pipe(
          docmap.steps,
          (steps) => Object.entries(steps).map(([k, v]) => ({
            step: k,
            ...(v['previous-step'] ? { 'previous-step': v['previous-step'] } : {}),
            ...(v['next-step'] ? { 'next-step': v['next-step'] } : {}),
            actions: v.actions.map(({ inputs, outputs }) => ({
              inputs: inputs.map(({ doi }) => ({ doi })),
              outputs: outputs.map(({ doi, type }) => ({ doi, type })),
            })),
            inputs: v.inputs.map(({ doi }) => ({ doi })),
          })),
          (entries) => JSON.stringify(entries, null, 2),
          (toLog) => (debug.includes(1) ? log(toLog)('Debug level: 1') : log()()),
        );

        return docmap;
      }),
      E.map((docmap) => {
        pipe(
          JSON.stringify(docmap, null, 2),
          (toLog) => (debug.includes(2) ? log(toLog)('Debug level: 2') : log()()),
        );

        return docmap;
      }),
    )),
  )();

  const runPrograms = async (configs: ReadonlyArray<ProgramConfig>) => {
    await Promise.all(configs.map(async ({ url, debug = [0, 1] }) => runProgram(url, debug)));
  };

  await runPrograms([
    {
      url: 'https://inbox-sciety-prod.elifesciences.org/inbox/urn:uuid:bf3513ee-1fef-4f30-a61b-20721b505f11',
    },
    {
      url: 'https://inbox-sciety-prod.elifesciences.org/inbox/urn:uuid:348fcff8-a313-4051-9437-810acfaaf5cd',
    },
  ]);
})();
