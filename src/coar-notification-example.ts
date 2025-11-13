import axios from 'axios';
import * as E from 'fp-ts/Either';
import type * as IO from 'fp-ts/IO';
import * as RA from 'fp-ts/ReadonlyArray';
import * as R from 'fp-ts/Record';
import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';
import * as S from 'fp-ts/string';
import LinkHeader from 'http-link-header';
import * as t from 'io-ts';
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
    ACTION_DOI: 'Action DOI',
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

  type DebugLog = (prefix: string, debugLevel?: DebugLevel) => <A>(data: A) => IO.IO<void>;

  const outputLogEntry = (entry: LogEntry) => {
    const formattedData = typeof entry.data === 'string' ? entry.data : jsonStringify(entry.data);
    log(`${entry.prefix}: ${formattedData}`)(`(Debug level: ${entry.debugLevel}) [item: ${entry.item}]`);
  };

  const createDebugLog = (
    store: LogEntries,
    item: Item,
    debugLevels: DebugLevels = [],
    outputImmediately: boolean = false,
  ) => (prefix: string, debugLevel?: DebugLevel) => <A>(data: A): IO.IO<void> => () => {
    const isDebugLevel = (
      value: string,
    ): value is DebugLevel => Object.values(debugLevelValues).includes(value as DebugLevel);

    const level: DebugLevel = debugLevel ?? (isDebugLevel(prefix) ? prefix : debugLevelValues.BASIC);

    if (debugLevels.includes(level)) {
      const entry: LogEntry = {
        prefix,
        item,
        debugLevel: level,
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

  const signpostingDocmapLinkCodec = t.strict({
    uri: t.string,
    rel: t.literal('describedby'),
    type: t.literal('application/ld+json'),
    profile: t.literal('https://w3id.org/docmaps/context.jsonld'),
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

  const actionWithDoi = t.strict({
    type: t.union([
      t.literal('editorial-decision'),
      t.literal('review'),
      t.literal('reply'),
    ]),
    doi: t.string,
  });

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
      TE.flatMapEither(codec.decode),
    );

  const axiosGet = axiosRequest(
    async (uri) => axios.get<JSON>(uri),
    ({ data }) => data,
  );

  const axiosHead = axiosRequest(
    async (uri) => axios.head(uri),
    ({ headers }) => headers,
  );

  const retrieveAnnouncementActionUriFromCoarNotificationUri = (
    debugLog: DebugLog,
  ) => (coarNotificationUri: string) => pipe(
    coarNotificationUri,
    axiosGet(notificationCodec, debugLog(debugLevelValues.COAR_NOTIFICATION)),
    TE.tapIO(debugLog(debugLevelValues.COAR_NOTIFICATION_ESSENTIALS)),
    TE.map(({ object }) => object.id),
  );

  const retrieveSignpostingDocmapUriFromAnnouncementActionUri = (
    debugLog: DebugLog,
  ) => (announcementActionUri: string) => pipe(
    announcementActionUri,
    axiosHead(headersLinkCodec, debugLog(debugLevelValues.EVALUATION_HEADERS)),
    TE.tapIO(debugLog(debugLevelValues.EVALUATION_HEADERS_ESSENTIALS)),
    TE.map(({ link }) => link),
    TE.map(LinkHeader.parse),
    TE.map(({ refs }) => refs),
    TE.map(RA.findFirst(signpostingDocmapLinkCodec.is)),
    TE.flatMap(TE.fromOption(() => new Error('Header links array is empty'))),
    TE.map((ref) => ref.uri),
  );

  const retrieveDocmapFromSignpostingDocmapUri = (
    debugLog: DebugLog,
  ) => (signpostingDocmapUri: string) => pipe(
    signpostingDocmapUri,
    axiosGet(docmapsCodec, debugLog(debugLevelValues.DOCMAP)),
    TE.tapIO(debugLog(debugLevelValues.DOCMAP_ESSENTIALS)),
    TE.map(RA.head),
    TE.flatMap(TE.fromOption(() => new Error('DocMaps array is empty'))),
  );

  const retrieveActionDoiFromDocmap = (
    debugLog: DebugLog,
  ) => (
    docmap: t.TypeOf<typeof docmapCodec>,
  ) => pipe(
    docmap.steps,
    R.map(
      (step) => step.actions.flatMap(
        (action) => action.outputs,
      ),
    ),
    R.collect(S.Ord)((_, value) => value),
    RA.flatten,
    RA.findFirst(actionWithDoi.is),
    E.fromOption(() => 'No action DOI found'),
    E.map(({ doi }) => doi),
    TE.fromEither,
    TE.tapIO(debugLog(debugLevelValues.ACTION_DOI)),
  );

  const retrieveDocmapFromCoarNotificationUri = async (
    coarNotificationUri: string,
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
      TE.of(coarNotificationUri),
      TE.tapIO(debugLog('(1a) retrieve action announcement uri from COAR notification uri', debugLevelValues.BASIC)),
      TE.flatMap(retrieveAnnouncementActionUriFromCoarNotificationUri(debugLog)),
      TE.tapIO(debugLog('(1b) retrieved action announcement uri', debugLevelValues.BASIC)),
      TE.tapIO(debugLog('(2a) retrieve signposting DocMap uri from action announcement uri', debugLevelValues.BASIC)),
      TE.flatMap(retrieveSignpostingDocmapUriFromAnnouncementActionUri(debugLog)),
      TE.tapIO(debugLog('(2b) retrieved signposting DocMap uri', debugLevelValues.BASIC)),
      TE.flatMap(retrieveDocmapFromSignpostingDocmapUri(debugLog)),
      TE.flatMap(retrieveActionDoiFromDocmap(debugLog)),
      TE.mapLeft(logError(`Error retrieving action DOI for item ${item}`)),
    )();
  };

  const retrieveDocmapsFromCoarNotificationUris = async (
    configs: ReadonlyArray<{ uuid: string, debug?: DebugLevels }>,
  ) => Promise.all(
    configs.map(async (
      { uuid, debug: debugLevels = [debugLevelValues.BASIC] },
    ) => retrieveDocmapFromCoarNotificationUri(
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
        debugLevelValues.ACTION_DOI,
      ],
    },
    {
      uuid: '9154949f-6da4-4f16-8997-a0762f19b05a',
      debug: [
        debugLevelValues.DOCMAP,
        debugLevelValues.ACTION_DOI,
      ],
    },
    {
      uuid: '7140557f-6fe6-458f-ad59-21a9d53c8eb2',
      debug: [
        debugLevelValues.EVALUATION_HEADERS,
        debugLevelValues.ACTION_DOI,
      ],
    },
  ]);
})();
