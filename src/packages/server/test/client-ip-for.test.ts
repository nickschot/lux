import { it, describe, expect } from 'vitest';

import clientIpFor from '../utils/client-ip-for';
import type { Request } from '../request/interfaces';

function requestFrom(remoteAddress: string, forwardedFor?: string) {
  const headers = new Map<string, string>();

  if (forwardedFor !== undefined) {
    headers.set('x-forwarded-for', forwardedFor);
  }

  return { headers, socket: { remoteAddress } } as unknown as Request;
}

describe('util clientIpFor()', () => {
  it('is the connection address by default', () => {
    expect(clientIpFor(requestFrom('10.1.36.112', '203.0.113.7'))).to.equal(
      '10.1.36.112'
    );
  });

  it("is the proxy's X-Forwarded-For entry behind a trusted proxy", () => {
    expect(
      clientIpFor(requestFrom('10.1.36.112', '203.0.113.7'), true)
    ).to.equal('203.0.113.7');
  });

  it('ignores entries the client sent ahead of the proxy', () => {
    expect(
      clientIpFor(requestFrom('10.1.36.112', '1.2.3.4, 203.0.113.7'), true)
    ).to.equal('203.0.113.7');
  });

  it('falls back to the connection without the header', () => {
    expect(clientIpFor(requestFrom('10.1.36.112'), true)).to.equal(
      '10.1.36.112'
    );
  });
});
