import { it, describe, expect } from 'vitest';

import requestIdFor from '../utils/request-id-for';
import type { Request } from '../request/interfaces';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function requestWith(id?: string) {
  const headers = new Map<string, string>();

  if (id !== undefined) {
    headers.set('x-request-id', id);
  }

  return { headers } as Request;
}

describe('util requestIdFor()', () => {
  it('adopts a well-formed client id', () => {
    expect(requestIdFor(requestWith('a1b2-C3.d4:e5_f6'))).to.equal(
      'a1b2-C3.d4:e5_f6'
    );
  });

  it('generates a UUID without one', () => {
    expect(requestIdFor(requestWith())).to.match(UUID);
  });

  it('generates a fresh UUID per request', () => {
    expect(requestIdFor(requestWith())).to.not.equal(
      requestIdFor(requestWith())
    );
  });

  it('replaces an id that could forge log lines', () => {
    expect(requestIdFor(requestWith('x\n{"level":"ERROR"}'))).to.match(UUID);
    expect(requestIdFor(requestWith('has space'))).to.match(UUID);
  });

  it('replaces an id that is too long', () => {
    expect(requestIdFor(requestWith('a'.repeat(129)))).to.match(UUID);
    expect(requestIdFor(requestWith('a'.repeat(128)))).to.equal(
      'a'.repeat(128)
    );
  });
});
