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
  enum DebugLevelValues {
    BASIC,
    EVALUATION_HEADERS,
    DOCMAP_ESSENTIAL,
    DOCMAP_COMPLETE,
  }

  type DebugLevel = DebugLevelValues;

  type DebugLevels = Array<DebugLevel>;

  type Item = string | number;

  const jsonStringify = (data: unknown) => JSON.stringify(data, null, 2);

  const debugLog = (message: string, debug: DebugLevels, debugLevel: DebugLevel, item: Item) => {
    if (debug.includes(debugLevel)) {
      return log(message)(`(Debug level: ${debugLevel}) [item: ${item}]`);
    }
  };

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

  const normaliseLinkHeader = (raw: string) => pipe(
    raw
      .replace(/>\s*;\s*/g, '>; ')
      .replace(/(?<!;)\s+(?=(type|profile|title|rev)=)/g, '; ')
      .replace(/;\s*;/g, '; ')
      .trim()
      .split(', ')
      .map(parseLinkHeader),
    RA.filter((l): l is NonNullable<typeof l> => l !== null),
  );

  const axiosGet = (url: string) => TE.tryCatch(async () => axios.get<unknown>(url), toError);

  const axiosHead = (url: string) => TE.tryCatch(async () => axios.head(url), toError);

  const logUrl = (message: string, item: Item, debug: DebugLevels = [DebugLevelValues.BASIC]) => (urlToLog: string) => {
    debugLog(`${message}: ${urlToLog}`, debug, DebugLevelValues.BASIC, item);
    return urlToLog;
  };

  const retrieveEvaluationUrlFromNotificationUrl = (
    item: Item,
    debug: DebugLevels = [DebugLevelValues.BASIC],
  ) => (url: string) => pipe(
    url,
    logUrl('Retrieve Docmap url from notification', item, debug),
    axiosGet,
    TE.chainEitherKW(({ data }) => pipe(data, notificationCodec.decode, E.map((n) => n.object.id))),
    TE.map((evaluationUrl) => logUrl('Step 1: retrieved evaluation url', item, debug)(evaluationUrl)),
  );

  const retrieveDocmapUrlFromEvaluationUrl = (
    item: Item,
    debug: DebugLevels = [DebugLevelValues.BASIC],
  ) => (url: string) => pipe(
    url,
    axiosHead,
    TE.chainEitherKW(({ headers }) => pipe(
      headers,
      headersLinkCodec.decode,
      E.map((decodedHeaders) => {
        debugLog(`Evaluation url headers: ${jsonStringify(decodedHeaders)}`, debug, DebugLevelValues.EVALUATION_HEADERS, item);
        return pipe(
          decodedHeaders.link,
          normaliseLinkHeader,
          RA.map(parsedHeadersLinkCodec.decode),
          RA.filterMap(E.matchW(() => O.none, O.some)),
          RA.last,
          O.map((l) => l.describedby.url),
          O.map((u) => logUrl('Step 2: retrieved Docmap url', item, debug)(u)),
          TE.fromOption(() => new Error('No application/ld+json describedby link found')),
        );
      }),
    )),
    TE.flatten,
  );

  const retrieveDocmapFromDocmapUrl = (url: string) => pipe(
    url,
    axiosGet,
    TE.map(({ data }) => pipe(
      data,
      docmapsCodec.decode,
      E.chainW((docmaps) => pipe(
        docmaps,
        RA.head,
        E.fromOption(() => new Error('Docmaps array is empty')),
      )),
    )),
  );

  const program = (item: Item, debug: DebugLevels = [DebugLevelValues.BASIC]) => (url: string) => pipe(
    url,
    retrieveEvaluationUrlFromNotificationUrl(item, debug),
    TE.chainW(retrieveDocmapUrlFromEvaluationUrl(item, debug)),
    TE.chainW(retrieveDocmapFromDocmapUrl),
  );

  const runProgram = async (url: string, item: Item, debug: DebugLevels = [DebugLevelValues.BASIC]) => {
    const logDocmap = (debugLevel: DebugLevel) => (docmapToLog: unknown) => {
      debugLog(jsonStringify(docmapToLog), debug, debugLevel, item);
      return docmapToLog;
    };

    return pipe(
      url,
      program(item, debug),
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
            logDocmap(DebugLevelValues.DOCMAP_ESSENTIAL),
          );

          return docmap;
        }),
        E.map((docmap) => {
          logDocmap(DebugLevelValues.DOCMAP_COMPLETE)(docmap);
          return docmap;
        }),
      )),
    )();
  };

  const runPrograms = async (
    configs: ReadonlyArray<{ uuid?: string, url?: string, debug?: DebugLevels }>,
  ) => Promise.all(
    configs.map(async ({ uuid, url, debug = [DebugLevelValues.BASIC] }, index) => runProgram(
      url ?? `https://inbox-sciety-prod.elifesciences.org/inbox/urn:uuid:${uuid ?? ''}`,
      uuid ?? index,
      (debug.length > 0 && !debug.includes(DebugLevelValues.BASIC))
        ? [DebugLevelValues.BASIC, ...debug]
        : debug,
    )),
  );

  await runPrograms([
    {
      uuid: 'bf3513ee-1fef-4f30-a61b-20721b505f11',
    },
    {
      uuid: '9154949f-6da4-4f16-8997-a0762f19b05a',
    },
    {
      uuid: '7140557f-6fe6-458f-ad59-21a9d53c8eb2',
      debug: [
        DebugLevelValues.EVALUATION_HEADERS,
      ],
    },
  ]);
})();
