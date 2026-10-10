import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { expect } from 'vitest';

import schema from '../jsonapi-schema/1.0.json' with { type: 'json' };

// The schema still uses draft-07's `dependencies` (`included` needs `data`),
// which draft 2020-12 renamed; strict mode would reject it as unknown.
const ajv = new Ajv2020({ allErrors: true, strict: false });

addFormats.default(ajv);

const validate = ajv.compile(schema);

/**
 * Where the schema is stricter than the JSON:API 1.0 text, which wins (the
 * schema is informative): a copy of the document the rule doesn't apply to.
 */
const SPEC_EXCEPTIONS: Array<(document: Record<string, unknown>) => void> = [
  // The schema makes `errors` `uniqueItems`; the spec only asks for an array
  // of error objects. Two different problems can look alike once `detail` is
  // hidden outside development (`{ status: '422', title: … }` twice).
  document => {
    if (Array.isArray(document.errors)) {
      document.errors = document.errors.map((error, index) => ({
        ...error,
        meta: { ...error?.meta, index }
      }));
    }
  }
];

/**
 * Known deviations, each tracked by an issue: a copy of the document with
 * that one bug undone, so it is validated for everything else. Keep each as
 * narrow as the bug, and delete it with the fix.
 */
const KNOWN_DEVIATIONS: Array<(document: Record<string, unknown>) => void> = [
  // #149: reactions serialize their `type` column as an attribute, which
  // JSON:API forbids (`type` and `id` share the fields' namespace).
  document => {
    const resources = [document.data, document.included].flat();

    resources.forEach(resource => {
      const { type, attributes } = (resource ?? {}) as {
        type?: string;
        attributes?: Record<string, unknown>;
      };

      if (type === 'reactions' && attributes) {
        delete attributes.type;
      }
    });
  },

  // #150: a non-paged `links.self` repeats the request's query as sent, with
  // `[` and `]` unencoded, which isn't a valid URI.
  document => {
    const links = document.links as Record<string, unknown> | undefined;

    if (typeof links?.self === 'string') {
      links.self = links.self.replace(/\[/g, '%5B').replace(/\]/g, '%5D');
    }
  }
];

/**
 * Assert that `body` is a JSON:API 1.0 response document, per the schema in
 * `test/jsonapi-schema/`. Fails with every violation, each with its path.
 */
export default function expectJsonApiDocument(body: unknown): void {
  const document = structuredClone(body);

  if (document && typeof document === 'object' && !Array.isArray(document)) {
    [...SPEC_EXCEPTIONS, ...KNOWN_DEVIATIONS].forEach(undo =>
      undo(document as Record<string, unknown>)
    );
  }

  if (validate(document)) {
    return;
  }

  const problems = (validate.errors ?? []).map(
    ({ instancePath, message, params }) =>
      `  ${instancePath || '/'} ${message} ${JSON.stringify(params)}`
  );

  expect.fail(`not a valid JSON:API document:\n${problems.join('\n')}`);
}

/**
 * A response's JSON body (`undefined` when empty), checked with
 * `expectJsonApiDocument` when the response says it is a JSON:API document.
 * Use it in HTTP tests instead of `res.json()`, so every document they fetch
 * is validated.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests read the members they assert on
export async function readDocument(res: Response): Promise<any> {
  const text = await res.text();

  if (!text) {
    return undefined;
  }

  const body: unknown = JSON.parse(text);

  if (res.headers.get('content-type')?.startsWith('application/vnd.api+json')) {
    expectJsonApiDocument(body);
  }

  return body;
}
