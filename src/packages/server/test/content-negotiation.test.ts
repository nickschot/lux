import { it, describe, expect } from 'vitest';

import validateAccept from '../utils/validate-accept';
import validateContentType from '../utils/validate-content-type';

const JSONAPI = 'application/vnd.api+json';

function statusOf(fn: () => unknown): number {
  try {
    fn();
  } catch (err) {
    return (err as { statusCode: number }).statusCode;
  }

  return 200;
}

describe('module "server"', () => {
  describe('#validateAccept()', () => {
    const cases: Array<[string | undefined, number]> = [
      [undefined, 200],
      ['', 200],
      ['*/*', 200],
      ['text/html', 200],
      [JSONAPI, 200],
      ['Application/VND.API+JSON', 200],
      [`${JSONAPI};q=0.9`, 200],
      [`text/html, ${JSONAPI}`, 200],
      // One unmodified instance is enough.
      [`${JSONAPI};charset=utf-8, ${JSONAPI}`, 200],
      // 1.0 is literal: a wildcard does not rescue modified instances.
      [`${JSONAPI};ext=bulk, */*`, 406],
      // Every instance modified -> 406, whatever the parameter or spacing.
      [`${JSONAPI};charset=utf-8`, 406],
      [`${JSONAPI}; charset=utf-8`, 406],
      [`${JSONAPI};ext=bulk`, 406],
      [`${JSONAPI};ext=bulk;q=0.5`, 406],
      [`${JSONAPI};ext=a, ${JSONAPI};ext=b`, 406]
    ];

    cases.forEach(([accept, expected]) => {
      it(`responds ${expected} for Accept: ${String(accept)}`, () => {
        expect(statusOf(() => validateAccept(accept))).to.equal(expected);
      });
    });
  });

  describe('#validateContentType()', () => {
    const cases: Array<[string | undefined, number]> = [
      [JSONAPI, 200],
      ['Application/VND.API+JSON', 200],
      [`${JSONAPI};`, 200],
      [undefined, 415],
      ['application/json', 415],
      [`${JSONAPI}foo`, 415],
      [`${JSONAPI};charset=utf-8`, 415],
      [`${JSONAPI}; charset=utf-8`, 415],
      [`${JSONAPI}; foo=bar`, 415]
    ];

    cases.forEach(([contentType, expected]) => {
      it(`responds ${expected} for Content-Type: ${String(contentType)}`, () => {
        expect(statusOf(() => validateContentType(contentType))).to.equal(
          expected
        );
      });
    });
  });
});
