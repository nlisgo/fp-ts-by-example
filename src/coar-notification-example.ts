import axios from 'axios';
import * as IO from 'fp-ts/IO';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import * as t from 'io-ts';
import parseLinkHeader from 'parse-link-header';
import { log, logError, toError } from './utils/log';

void (async () => {
  const debugLevelValues = {
    BASIC: 'Basic',
    COAR_NOTIFICATION: 'COAR notification',
    COAR_NOTIFICATION_ESSENTIALS: 'COAR notification (essentials)',
    EVALUATION_HEADERS: 'Evaluation headers',
    EVALUATION_HEADERS_ESSENTIALS: 'Evaluation headers (essentials)',
    DOCMAP: 'DocMap',
    DOCMAP_ESSENTIALS: 'DocMap (essentials)',
  } as const;

  type DebugLevel = typeof debugLevelValues[keyof typeof debugLevelValues];

  type DebugLevels = Array<DebugLevel>;

  type Item = string | number;

  const jsonStringify = (data: unknown) => JSON.stringify(data, null, 2);

  type LogEntry = {
    prefix: string,
    item: Item,
    debugLevel: DebugLevel,
    data: unknown,
  };

  type LogEntries = Array<LogEntry>;

  type DebugLog = (prefix: string, debugLevel: DebugLevel) => <A>(data: A) => IO.IO<void>;

  const outputLogEntry = (entry: LogEntry) => {
    const formattedData = typeof entry.data === 'string' ? entry.data : jsonStringify(entry.data);
    log(`${entry.prefix}: ${formattedData}`)(`(Debug level: ${entry.debugLevel}) [item: ${entry.item}]`);
  };

  const createDebugLog = (
    store: LogEntries,
    item: Item,
    debugLevels: DebugLevels = [],
    outputImmediately: boolean = false,
  ) => (prefix: string, debugLevel: DebugLevel) => <A>(data: A): IO.IO<void> => () => {
    if (debugLevels.includes(debugLevel)) {
      const entry: LogEntry = {
        prefix,
        item,
        debugLevel,
        data,
      };

      if (outputImmediately) {
        outputLogEntry(entry);
      }

      store.push(entry);
    }
  };

  const notificationCodec = t.strict({
    object: t.strict({
      id: t.string,
    }),
  });

  const headersLinkCodec = t.strict({
    link: t.string,
  });

  const parsedHeadersLinkCodec = t.strict({
    describedby: t.strict({
      url: t.string,
      type: t.literal('application/ld+json'),
    }),
  });

  const stepCodec = t.intersection([
    t.type({
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

  const docmapCodec = t.strict({
    type: t.literal('docmap'),
    id: t.string,
    publisher: t.strict({
      name: t.string,
      url: t.string,
    }),
    created: t.string,
    updated: t.string,
    'first-step': t.literal('_:b0'),
    steps: t.record(t.string, stepCodec),
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
  ) => <A>(codec: t.Type<A>, debugLog: <B>(data: B) => IO.IO<void>) => (uri: string) => pipe(
      TE.tryCatch(
        async () => request(uri),
        toError,
      ),
      TE.map(extract),
      TE.tapIO(debugLog),
      TE.chainEitherKW(codec.decode),
    );

  const axiosGet = axiosRequest(
    async (uri) => axios.get<JSON>(uri),
    ({ data }) => data,
  );

  const axiosHead = axiosRequest(
    async (uri) => axios.head<JSON>(uri),
    ({ headers }) => headers,
  );

  const retrieveAnnouncementActionUriFromCoarNotificationUri = (
    debugLog: DebugLog,
  ) => (uri: string) => pipe(
    TE.of(uri),
    TE.tapIO(debugLog('Retrieve DocMap uri from notification', debugLevelValues.BASIC)),
    TE.chain(
      axiosGet(notificationCodec, debugLog(debugLevelValues.COAR_NOTIFICATION, debugLevelValues.COAR_NOTIFICATION)),
    ),
    TE.tapIO(debugLog(debugLevelValues.COAR_NOTIFICATION_ESSENTIALS, debugLevelValues.COAR_NOTIFICATION_ESSENTIALS)),
    TE.map(({ object }) => object.id),
    TE.tapIO(debugLog('Step 1: retrieved evaluation uri', debugLevelValues.BASIC)),
  );

  const retrieveSignpostingDocmapUriFromAnnouncementActionUri = (
    debugLog: DebugLog,
  ) => (uri: string) => pipe(
    uri,
    axiosHead(headersLinkCodec, debugLog(debugLevelValues.EVALUATION_HEADERS, debugLevelValues.EVALUATION_HEADERS)),
    TE.tapIO(debugLog(debugLevelValues.EVALUATION_HEADERS_ESSENTIALS, debugLevelValues.EVALUATION_HEADERS_ESSENTIALS)),
    TE.map(({ link }) => link),
    TE.map(normaliseLinkHeader),
    TE.map(RA.map(parsedHeadersLinkCodec.decode)),
    TE.map(RA.filterMap(O.getRight)),
    TE.map(RA.last),
    TE.chainW(TE.fromOption(() => new Error('Header links array is empty'))),
    TE.map(({ describedby }) => describedby.url),
    TE.tapIO(debugLog('Step 2: retrieved DocMap uri', debugLevelValues.BASIC)),
  );

  const retrieveDocmapFromSignpostingDocmapUri = (
    debugLog: DebugLog,
  ) => (uri: string) => pipe(
    uri,
    axiosGet(docmapsCodec, debugLog(debugLevelValues.DOCMAP, debugLevelValues.DOCMAP)),
    TE.tapIO(debugLog(debugLevelValues.DOCMAP_ESSENTIALS, debugLevelValues.DOCMAP_ESSENTIALS)),
    TE.map(RA.head),
    TE.chainW(TE.fromOption(() => new Error('DocMaps array is empty'))),
  );

  const retrieveDocmapFromCoarNotificationUri = (
    debugLog: DebugLog,
  ) => (uri: string) => pipe(
    uri,
    retrieveAnnouncementActionUriFromCoarNotificationUri(debugLog),
    TE.chain(retrieveSignpostingDocmapUriFromAnnouncementActionUri(debugLog)),
    TE.chain(retrieveDocmapFromSignpostingDocmapUri(debugLog)),
  );

  const retrieveDocmapFromCoarNotificationUriAndLog = async (
    uri: string,
    item: Item,
    debugLevels: DebugLevels = [debugLevelValues.BASIC],
  ) => {
    const logs: Array<LogEntry> = [];
    const debugLog = createDebugLog(
      logs,
      item,
      [
        ...(debugLevels.length > 0 && !debugLevels.includes(debugLevelValues.BASIC) ? [debugLevelValues.BASIC] : []),
        ...debugLevels,
      ],
      true,
    );

    return pipe(
      uri,
      retrieveDocmapFromCoarNotificationUri(debugLog),
      TE.mapLeft(logError(`Error retrieving docmap for item ${item}`)),
    )();
  };

  const retrieveDocmapsFromCoarNotificationUris = async (
    configs: ReadonlyArray<{ uuid: string, debug?: DebugLevels }>,
  ) => Promise.all(
    configs.map(async (
      { uuid, debug: debugLevels = [debugLevelValues.BASIC] },
    ) => retrieveDocmapFromCoarNotificationUriAndLog(
      `https://inbox-sciety-prod.elifesciences.org/inbox/urn:uuid:${uuid}`,
      uuid,
      debugLevels,
    )),
  );

  await retrieveDocmapsFromCoarNotificationUris([
    {
      uuid: 'bf3513ee-1fef-4f30-a61b-20721b505f11',
      debug: [
        debugLevelValues.COAR_NOTIFICATION,
      ],
    },
    {
      uuid: '9154949f-6da4-4f16-8997-a0762f19b05a',
      debug: [
        debugLevelValues.DOCMAP,
      ],
    },
    {
      uuid: '7140557f-6fe6-458f-ad59-21a9d53c8eb2',
      debug: [
        debugLevelValues.EVALUATION_HEADERS,
      ],
    },
  ]);
})();
