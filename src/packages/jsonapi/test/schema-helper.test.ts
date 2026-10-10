import { it, describe, expect } from 'vitest';

import expectJsonApiDocument from '../../../../test/utils/expect-jsonapi-document';

// The helper itself: it must accept a document and reject a broken one, or
// every test that uses it proves nothing.
describe('test helper expectJsonApiDocument()', () => {
  it('accepts a JSON:API document', () => {
    expect(() =>
      expectJsonApiDocument({
        data: [{ id: '1', type: 'posts', attributes: { title: 'Hello' } }],
        links: { self: 'http://localhost/posts' },
        jsonapi: { version: '1.0' }
      })
    ).not.to.throw();
  });

  it('rejects a broken one, naming where', () => {
    expect(() =>
      expectJsonApiDocument({
        data: [{ id: 1, type: 'posts' }],
        included: []
      })
    )
      .to.throw()
      .with.property('message')
      .that.includes('/data/0/id');
  });

  it('skips a known deviation only where it is known (#149)', () => {
    const withTypeAttribute = (type: string) => ({
      data: { id: '1', type, attributes: { type: 'like' } },
      jsonapi: { version: '1.0' }
    });

    expect(() =>
      expectJsonApiDocument(withTypeAttribute('reactions'))
    ).not.to.throw();
    expect(() => expectJsonApiDocument(withTypeAttribute('posts'))).to.throw(
      '/data/attributes'
    );
  });
});
