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
  enum DebugLevelValues {
    BASIC = 'Basic',
    COAR_NOTIFICATION = 'COAR notification',
    EVALUATION_HEADERS = 'Evaluation headers',
    DOCMAP_ESSENTIALS_ONLY = 'DocMap essentials',
    DOCMAP_COMPLETE = 'DocMap complete',
  }

  type DebugLevel = DebugLevelValues;

  type DebugLevels = Array<DebugLevel>;

  type Item = string | number;

  const jsonStringify = (data: unknown) => JSON.stringify(data, null, 2);

  type LogEntry = {
    prefix: string,
    item: Item,
    debugLevel: DebugLevel,
    data: unknown,
  };

  const collectedLogs: Array<LogEntry> = [];

  const debugLog = (prefix: string, item: Item, debugLevel: DebugLevel) => <A>(data: A) => {
    collectedLogs.push({
      prefix,
      item,
      debugLevel,
      data,
    });
  };

  const outputCollectedLogs = (item: Item, debugLevels: DebugLevels) => {
    collectedLogs
      .filter((entry) => item === entry.item && debugLevels.includes(entry.debugLevel))
      .forEach((entry) => {
        const formattedData = typeof entry.data === 'string' ? entry.data : jsonStringify(entry.data);
        log(`${entry.prefix}: ${formattedData}`)(`(Debug level: ${entry.debugLevel}) [item: ${entry.item}]`);
      });
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

  const retrieveAnnouncementActionUriFromCoarNotificationUri = (
    item: Item,
  ) => (uri: string) => pipe(
    uri,
    axiosGet(notificationCodec),
    TE.tapIO(() => () => debugLog('Retrieve DocMap uri from notification', item, DebugLevelValues.BASIC)(uri)),
    TE.tapIO((d) => () => debugLog('COAR notification', item, DebugLevelValues.COAR_NOTIFICATION)(d)),
    TE.map(({ object }) => object.id),
    TE.tapIO((d) => () => debugLog('Step 1: retrieved evaluation uri', item, DebugLevelValues.BASIC)(d)),
  );

  const retrieveSignpostingDocmapUriFromAnnouncementActionUri = (
    item: Item,
  ) => (uri: string) => pipe(
    uri,
    axiosHead(headersLinkCodec),
    TE.tapIO((d) => () => debugLog('Evaluation uri headers', item, DebugLevelValues.EVALUATION_HEADERS)(d)),
    TE.map(({ link }) => link),
    TE.map(normaliseLinkHeader),
    TE.map(RA.map(parsedHeadersLinkCodec.decode)),
    TE.map(RA.filterMap(O.getRight)),
    TE.map(RA.last),
    TE.chainW(TE.fromOption(() => new Error('Header links array is empty'))),
    TE.map(({ describedby }) => describedby.url),
    TE.tapIO((d) => () => debugLog('Step 2: retrieved DocMap uri', item, DebugLevelValues.BASIC)(d)),
  );

  const retrieveDocmapFromSignpostingDocmapUri = (uri: string) => pipe(
    uri,
    axiosGet(docmapsCodec),
    TE.map(RA.head),
    TE.chainW(TE.fromOption(() => new Error('DocMaps array is empty'))),
  );

  const retrieveDocmapFromCoarNotificationUri = (
    item: Item,
  ) => (uri: string) => pipe(
    uri,
    retrieveAnnouncementActionUriFromCoarNotificationUri(item),
    TE.chain(retrieveSignpostingDocmapUriFromAnnouncementActionUri(item)),
    TE.chain(retrieveDocmapFromSignpostingDocmapUri),
  );

  const retrieveDocmapFromCoarNotificationUriAndLog = async (
    uri: string,
    item: Item,
    debug: DebugLevels = [DebugLevelValues.BASIC],
  ) => {
    const logDocmap = (
      debugLevel: DebugLevel,
      complete: boolean = true,
    ) => (docmap: t.TypeOf<typeof docmapCodec>): IO.IO<void> => () => {
      debugLog('DocMap', item, debugLevel)(complete ? docmap : pipe(
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
      ));
    };

    return pipe(
      uri,
      retrieveDocmapFromCoarNotificationUri(item),
      TE.tapIO(logDocmap(DebugLevelValues.DOCMAP_ESSENTIALS_ONLY, false)),
      TE.tapIO(logDocmap(DebugLevelValues.DOCMAP_COMPLETE)),
      TE.tapIO(() => () => {
        log('Debug', item)(`Levels: ${debug.join(', ')}`);
        outputCollectedLogs(item, debug);
      }),
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
