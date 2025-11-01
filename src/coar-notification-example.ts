import axios from 'axios';
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
    COAR_NOTIFICATION,
    EVALUATION_HEADERS,
    DOCMAP_ESSENTIALS_ONLY,
    DOCMAP_COMPLETE,
  }

  type DebugLevel = DebugLevelValues;

  type DebugLevels = Array<DebugLevel>;

  type Item = string | number;

  const jsonStringify = (data: unknown) => JSON.stringify(data, null, 2);

  const debugLog = (prefix: string, debug: DebugLevels, debugLevel: DebugLevel, item: Item) => <A>(data: A) => {
    if (debug.includes(debugLevel)) {
      log(`${prefix}: ${typeof data === 'string' ? data : jsonStringify(data)}`)(`(Debug level: ${debugLevel}) [item: ${item}]`);
    }

    return data;
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
    t.type({
      inputs: t.readonlyArray(
        t.type({
          doi: t.string,
        }),
      ),
      actions: t.readonlyArray(
        t.type({
          outputs: t.readonlyArray(
            t.type({
              published: t.string,
              doi: t.string,
              type: t.string,
            }),
          ),
          inputs: t.readonlyArray(
            t.type({
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

  const docmapCodec = t.type({
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

  const axiosRequest = <R>(
    request: (uri: string) => Promise<R>,
    extract: (response: R) => unknown,
  ) => <A>(codec: t.Type<A>) => (uri: string) => pipe(
      TE.tryCatch(
        async () => request(uri),
        toError,
      ),
      TE.map(extract),
      TE.chainEitherKW(codec.decode),
    );

  const axiosGet = axiosRequest(
    async (uri) => axios.get<JSON>(uri),
    (res) => res.data,
  );

  const axiosHead = axiosRequest(
    async (uri) => axios.head<JSON>(uri),
    (res) => res.headers,
  );

  const logUri = (
    message: string,
    item: Item,
    debug: DebugLevels = [DebugLevelValues.BASIC],
  ) => (uri: string) => debugLog(message, debug, DebugLevelValues.BASIC, item)(uri);

  const retrieveAnnouncementActionUriFromCoarNotificationUri = (
    item: Item,
    debug: DebugLevels = [DebugLevelValues.BASIC],
  ) => (uri: string) => pipe(
    uri,
    logUri('Retrieve DocMap uri from notification', item, debug),
    axiosGet(notificationCodec),
    TE.map(debugLog('COAR notification', debug, DebugLevelValues.COAR_NOTIFICATION, item)),
    TE.map(({ object }) => object.id),
    TE.map(logUri('Step 1: retrieved evaluation uri', item, debug)),
  );

  const retrieveSignpostingDocmapUriFromAnnouncementActionUri = (
    item: Item,
    debug: DebugLevels = [DebugLevelValues.BASIC],
  ) => (uri: string) => pipe(
    uri,
    axiosHead(headersLinkCodec),
    TE.map(debugLog('Evaluation uri headers', debug, DebugLevelValues.EVALUATION_HEADERS, item)),
    TE.map(({ link }) => link),
    TE.map(normaliseLinkHeader),
    TE.map(RA.map(parsedHeadersLinkCodec.decode)),
    TE.map(RA.filterMap(O.getRight)),
    TE.map(RA.last),
    TE.chainW(TE.fromOption(() => new Error('Header links array is empty'))),
    TE.map(({ describedby }) => describedby.url),
    TE.map(logUri('Step 2: retrieved DocMap uri', item, debug)),
  );

  const retrieveDocmapFromSignpostingDocmapUri = (uri: string) => pipe(
    uri,
    axiosGet(docmapsCodec),
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
      debug: [
        DebugLevelValues.COAR_NOTIFICATION,
      ],
    },
    {
      uuid: '9154949f-6da4-4f16-8997-a0762f19b05a',
      debug: [
        DebugLevelValues.DOCMAP_ESSENTIALS_ONLY,
      ],
    },
    {
      uuid: '7140557f-6fe6-458f-ad59-21a9d53c8eb2',
      debug: [
        DebugLevelValues.EVALUATION_HEADERS,
      ],
    },
  ]);
})();
