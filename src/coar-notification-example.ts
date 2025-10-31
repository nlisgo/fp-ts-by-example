import axios from 'axios';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import * as t from 'io-ts';
import parseLinkHeader from 'parse-link-header';
import { log, logError, toError } from './utils/log';

void (async () => {
  enum DebugLevelValues {
    BASIC,
    EVALUATION_HEADERS,
    DOCMAP_ESSENTIALS_ONLY,
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

  const normaliseLinkHeader = (raw: string) => pipe(
    raw
      .replace(/>\s*;\s*/g, '>; ')
      .replace(/(?<!;)\s+(?=(type|profile|title|rev)=)/g, '; ')
      .replace(/;\s*;/g, '; ')
      .trim()
      .split(', ')
      .map(parseLinkHeader),
    RA.filter((link): link is NonNullable<typeof link> => link !== null),
  );

  const axiosGet = (uri: string) => pipe(
    TE.tryCatch(async () => axios.get<JSON>(uri), toError),
    TE.map(({ data }) => data),
  );

  const axiosHead = (uri: string) => TE.tryCatch(async () => axios.head(uri), toError);

  const logUri = (message: string, item: Item, debug: DebugLevels = [DebugLevelValues.BASIC]) => (uri: string) => {
    debugLog(`${message}: ${uri}`, debug, DebugLevelValues.BASIC, item);
    return uri;
  };

  const retrieveAnnouncementActionUriFromCoarNotificationUri = (
    item: Item,
    debug: DebugLevels = [DebugLevelValues.BASIC],
  ) => (uri: string) => pipe(
    uri,
    logUri('Retrieve DocMap uri from notification', item, debug),
    axiosGet,
    TE.chainEitherKW(notificationCodec.decode),
    TE.map(({ object }) => object.id),
    TE.map((evaluationUrl) => logUri('Step 1: retrieved evaluation uri', item, debug)(evaluationUrl)),
  );

  const retrieveSignpostingDocmapUriFromAnnouncementActionUri = (
    item: Item,
    debug: DebugLevels = [DebugLevelValues.BASIC],
  ) => (uri: string) => pipe(
    uri,
    axiosHead,
    TE.chainEitherKW(({ headers }) => headersLinkCodec.decode(headers)),
    TE.map((decodedHeaders) => {
      debugLog(`Evaluation uri headers: ${jsonStringify(decodedHeaders)}`, debug, DebugLevelValues.EVALUATION_HEADERS, item);
      return decodedHeaders;
    }),
    TE.map(({ link }) => link),
    TE.map(normaliseLinkHeader),
    TE.map(RA.map(parsedHeadersLinkCodec.decode)),
    TE.map(RA.filterMap(E.matchW(() => O.none, O.some))),
    TE.map(RA.last),
    TE.chainW(TE.fromOption(() => new Error('Header links array is empty'))),
    TE.map(({ describedby }) => describedby.url),
    TE.map(logUri('Step 2: retrieved DocMap uri', item, debug)),
  );

  const retrieveDocmapFromSignpostingDocmapUri = (uri: string) => pipe(
    uri,
    axiosGet,
    TE.chainEitherKW(docmapsCodec.decode),
    TE.map(RA.head),
    TE.chainW(TE.fromOption(() => new Error('DocMaps array is empty'))),
  );

  const retrieveDocmapFromCoarNotificationUri = (
    item: Item,
    debug: DebugLevels = [DebugLevelValues.BASIC],
  ) => (uri: string) => pipe(
    uri,
    retrieveAnnouncementActionUriFromCoarNotificationUri(item, debug),
    TE.chain(retrieveSignpostingDocmapUriFromAnnouncementActionUri(item, debug)),
    TE.chain(retrieveDocmapFromSignpostingDocmapUri),
  );

  const retrieveDocmapFromCoarNotificationUriAndLog = async (
    uri: string,
    item: Item,
    debug: DebugLevels = [DebugLevelValues.BASIC],
  ) => {
    const logDocmap = (debugLevel: DebugLevel, complete: boolean = true) => (docmap: t.TypeOf<typeof docmapCodec>) => {
      debugLog(jsonStringify(complete ? docmap : pipe(
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
      )), debug, debugLevel, item);
      return docmap;
    };

    return pipe(
      uri,
      retrieveDocmapFromCoarNotificationUri(item, debug),
      TE.map(logDocmap(DebugLevelValues.DOCMAP_ESSENTIALS_ONLY, false)),
      TE.map(logDocmap(DebugLevelValues.DOCMAP_COMPLETE)),
      TE.mapLeft(logError(`Error retrieving docmap for item ${item}`)),
    )();
  };

  const retrieveDocmapsFromCoarNotificationUris = async (
    configs: ReadonlyArray<{ uuid: string, debug?: DebugLevels }>,
  ) => Promise.all(
    configs.map(async (
      { uuid, debug = [DebugLevelValues.BASIC] },
    ) => retrieveDocmapFromCoarNotificationUriAndLog(
      `https://inbox-sciety-prod.elifesciences.org/inbox/urn:uuid:${uuid}`,
      uuid,
      (debug.length > 0 && !debug.includes(DebugLevelValues.BASIC))
        ? [DebugLevelValues.BASIC, ...debug]
        : debug,
    )),
  );

  await retrieveDocmapsFromCoarNotificationUris([
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
