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
          log(JSON.stringify(entries, null, 2))();
          return docmap;
        }),
      )),
    )),
  );

  await program();
})();
